import {
  FICTION_NOTICE,
  type CaseCreatedView,
  type CustomCaseRequest,
  type EvidenceDetail,
  type EvidenceListView,
  type GenerationStatusView,
  type PublicCase,
} from "@amr/shared";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import type { Logger } from "../utils/logger.js";
import type { CaseDocument } from "../models/Case.js";
import type { SolutionDocument } from "../models/Solution.js";
import { getDatabase } from "../db/database.js";
import { newId } from "../utils/ids.js";
import {
  findCaseByCreatorAndIdempotency,
  findCaseById,
  insertCase,
  isDuplicateKeyError,
  updateCase,
} from "../repositories/cases.js";
import {
  countEvidenceByCaseId,
  findEvidenceByCaseId,
  findEvidenceById,
  insertEvidence,
} from "../repositories/evidence.js";
import {
  findGenerationJobById,
  insertGenerationJob,
  updateGenerationJob,
} from "../repositories/generation-jobs.js";
import { findSolutionByCaseId, insertSolution } from "../repositories/solutions.js";
import {
  findSuspectsByCaseId,
  insertSuspects,
} from "../repositories/suspects.js";
import { PROMPT_VERSION } from "../generation/prompt.js";
import { validateCaseStructure } from "./case-validation.js";
import {
  instantiateSampleCase,
  type InstantiatedSampleCase,
} from "./sample-case.js";
import {
  orderedSuspects,
  toEvidenceDetail,
  toEvidenceListView,
  toGenerationStatusView,
  toPublicCase,
} from "./presenters.js";
import type { GenerationService } from "./generation-service.js";

export interface CaseServiceDependencies {
  config: AppConfig;
  logger: Logger;
  generationService: GenerationService;
}

export interface CreatedSampleCase {
  data: CaseCreatedView;
  created: boolean;
}

export type CreatedCustomCase =
  | { kind: "accepted"; generation: GenerationStatusView }
  | { kind: "ready"; data: CaseCreatedView; created: boolean };

export class CaseService {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly generationService: GenerationService;

  constructor({ config, logger, generationService }: CaseServiceDependencies) {
    this.config = config;
    this.logger = logger;
    this.generationService = generationService;
  }

  async createSampleCase(
    guestHash: string,
    idempotencyKey?: string,
  ): Promise<CreatedSampleCase> {
    if (idempotencyKey) {
      const existing = await findCaseByCreatorAndIdempotency(guestHash, idempotencyKey);
      if (existing) {
        await this.getAccessibleCase(existing._id, guestHash);
        return {
          data: await this.toCreatedView(existing),
          created: false,
        };
      }
    }

    const startedAt = Date.now();
    const instantiated = instantiateSampleCase();
    instantiated.caseDoc.creatorSessionId = guestHash;
    if (idempotencyKey) {
      instantiated.caseDoc.idempotencyKey = idempotencyKey;
    }
    instantiated.caseDoc.status = "validating";

    const validation = validateCaseStructure(instantiated);
    if (!validation.valid) {
      this.logger.error(
        { issues: validation.issues.map((issue) => issue.code) },
        "sample case failed deterministic validation",
      );
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The sample case failed validation and was not published.",
      );
    }

    try {
      await this.persistSampleCase(instantiated);
    } catch (error) {
      if (idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await findCaseByCreatorAndIdempotency(guestHash, idempotencyKey);
        if (existing) {
          await this.getAccessibleCase(existing._id, guestHash);
          return {
            data: await this.toCreatedView(existing),
            created: false,
          };
        }
      }

      this.logger.error(
        { err: error, durationMs: Date.now() - startedAt },
        "sample case persistence failed",
      );
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The sample case could not be prepared. Please try again.",
        { cause: error },
      );
    }

    const persisted = await findCaseById(instantiated.caseDoc._id);
    if (!persisted) {
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The sample case could not be loaded after creation.",
      );
    }

    this.logger.info(
      {
        caseId: persisted._id,
        generationId: persisted.generationId,
        durationMs: Date.now() - startedAt,
        provider: "mock",
      },
      "sample case published",
    );

    return {
      data: await this.toCreatedView(persisted),
      created: true,
    };
  }

  async createCustomCase(
    request: CustomCaseRequest,
    guestHash: string,
    idempotencyKey?: string,
  ): Promise<CreatedCustomCase> {
    if (idempotencyKey) {
      const existing = await findCaseByCreatorAndIdempotency(guestHash, idempotencyKey);
      if (existing) {
        return this.resolveExistingCustomCase(existing);
      }
    }

    const caseId = newId();
    const generationId = newId();
    const provider = this.config.aiProvider;

    try {
      await getDatabase().transaction(async (database) => {
        await insertCase(
          {
            _id: caseId,
            title: "Preparing case file",
            scenario: request.scenario,
            summary: "The submitted brief is being prepared into a complete case file.",
            category: request.category,
            difficulty: request.difficulty,
            status: "generating",
            creatorSessionId: guestHash,
            suspectIds: [],
            evidenceIds: [],
            generationVersion: `${provider}:${PROMPT_VERSION}`,
            generationId,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            isSample: false,
            isPublic: false,
            incident: {
              location: "Pending generation",
              occurredAt: new Date().toISOString(),
              description: "The case brief is being prepared.",
            },
            timezone: "UTC",
            caseRules: [],
            fictionNotice: FICTION_NOTICE,
            timeline: [],
          },
          database,
        );

        await insertGenerationJob(
          {
            _id: generationId,
            caseId,
            creatorSessionId: guestHash,
            status: "pending",
            stage: "queued",
            attempts: 0,
            provider,
            promptVersion: PROMPT_VERSION,
            message: "Brief accepted. Waiting for the generator.",
          },
          database,
        );
      });
    } catch (error) {
      if (idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await findCaseByCreatorAndIdempotency(guestHash, idempotencyKey);
        if (existing) {
          return this.resolveExistingCustomCase(existing);
        }
      }

      this.logger.error(
        { err: error, caseId },
        "custom case record could not be created",
      );
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The case brief could not be accepted. Please try again.",
        { cause: error },
      );
    }

    this.generationService.start({
      caseId,
      generationId,
      creatorSessionId: guestHash,
      request,
    });

    const job = await findGenerationJobById(generationId);
    if (!job) {
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The case generation record could not be loaded.",
      );
    }

    this.logger.info(
      {
        caseId,
        generationId,
        provider,
      },
      "custom generation accepted",
    );

    return { kind: "accepted", generation: toGenerationStatusView(job) };
  }

  private async resolveExistingCustomCase(
    caseDoc: CaseDocument,
  ): Promise<CreatedCustomCase> {
    const job = await findGenerationJobById(caseDoc.generationId);
    if (!job) {
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The case generation record is missing.",
      );
    }

    if (caseDoc.status === "ready") {
      return {
        kind: "ready",
        data: await this.toCreatedView(caseDoc),
        created: false,
      };
    }
    if (caseDoc.status === "generating" || caseDoc.status === "validating") {
      return { kind: "accepted", generation: toGenerationStatusView(job) };
    }

    throw new AppError(
      409,
      "GENERATION_FAILED",
      "The previous attempt with this idempotency key failed. Submit the brief again with a new request.",
    );
  }

  async getPublicCase(caseId: string, guestHash: string): Promise<PublicCase> {
    const caseDoc = await this.getAccessibleCase(caseId, guestHash);
    const [suspectDocs, evidenceCount] = await Promise.all([
      findSuspectsByCaseId(caseDoc._id),
      countEvidenceByCaseId(caseDoc._id),
    ]);
    return toPublicCase(caseDoc, suspectDocs, evidenceCount);
  }

  async listEvidence(caseId: string, guestHash: string): Promise<EvidenceListView> {
    const caseDoc = await this.getAccessibleCase(caseId, guestHash);
    const evidenceDocs = await findEvidenceByCaseId(caseDoc._id);
    return toEvidenceListView(evidenceDocs);
  }

  async getEvidence(evidenceId: string, guestHash: string): Promise<EvidenceDetail> {
    const evidence = await findEvidenceById(evidenceId);
    if (!evidence) {
      throw new AppError(404, "EVIDENCE_NOT_FOUND", "That exhibit was not found.");
    }
    const caseDoc = await this.getAccessibleCase(evidence.caseId, guestHash);
    return toEvidenceDetail(evidence, caseDoc.fictionNotice);
  }

  async getGenerationStatus(
    generationId: string,
    guestHash: string,
  ): Promise<GenerationStatusView> {
    const job = await findGenerationJobById(generationId);
    if (!job) {
      throw new AppError(404, "NOT_FOUND", "That generation record was not found.");
    }

    const caseDoc = await findCaseById(job.caseId);
    if (!caseDoc) {
      throw new AppError(404, "NOT_FOUND", "That generation record was not found.");
    }

    const ownsCase =
      caseDoc.creatorSessionId === guestHash && caseDoc.creatorSessionId.length > 0;
    if (!ownsCase && !caseDoc.isPublic) {
      throw new AppError(404, "NOT_FOUND", "That generation record was not found.");
    }

    return toGenerationStatusView(job);
  }

  async getAccessibleCase(caseId: string, guestHash: string): Promise<CaseDocument> {
    const caseDoc = await findCaseById(caseId);
    if (!caseDoc) {
      throw new AppError(404, "CASE_NOT_FOUND", "That case was not found.");
    }

    const ownsCase =
      caseDoc.creatorSessionId === guestHash && caseDoc.creatorSessionId.length > 0;
    if (!caseDoc.isPublic && !ownsCase) {
      // Do not confirm the existence of another guest's private case.
      throw new AppError(404, "CASE_NOT_FOUND", "That case was not found.");
    }

    if (caseDoc.status !== "ready") {
      throw new AppError(
        409,
        "CASE_NOT_READY",
        caseDoc.status === "failed"
          ? "That case failed generation and cannot be played."
          : "That case is still being prepared.",
      );
    }

    return caseDoc;
  }

  async getSolution(caseId: string): Promise<SolutionDocument> {
    const solution = await findSolutionByCaseId(caseId);
    if (!solution) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "The case solution is unavailable.",
      );
    }
    return solution;
  }

  private async persistSampleCase(
    instantiated: InstantiatedSampleCase,
  ): Promise<void> {
    const { caseDoc, suspectDocs, evidenceDocs, solutionDoc } = instantiated;

    await getDatabase().transaction(async (database) => {
      await insertCase(caseDoc, database);
      await insertSuspects(suspectDocs, database);
      await insertEvidence(evidenceDocs, database);
      await insertSolution(solutionDoc, database);
      await insertGenerationJob(
        {
          _id: caseDoc.generationId,
          caseId: caseDoc._id,
          creatorSessionId: caseDoc.creatorSessionId,
          status: "validating",
          stage: "deterministic_validation_passed",
          attempts: 1,
          provider: "mock",
          promptVersion: "sample-v1",
        },
        database,
      );
      await updateCase(caseDoc._id, { status: "ready" }, database);
      await updateGenerationJob(
        caseDoc.generationId,
        {
          status: "ready",
          stage: "published",
          completedAt: new Date(),
        },
        database,
      );
    });
  }

  private async toCreatedView(caseDoc: CaseDocument): Promise<CaseCreatedView> {
    const [suspectDocs, evidenceCount] = await Promise.all([
      findSuspectsByCaseId(caseDoc._id),
      countEvidenceByCaseId(caseDoc._id),
    ]);
    return {
      case: toPublicCase(caseDoc, orderedSuspects(caseDoc, suspectDocs), evidenceCount),
      generationId: caseDoc.generationId,
      sample: caseDoc.isSample,
    };
  }
}
