import { Types, type HydratedDocument } from "mongoose";
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
import { CaseModel, type CaseDocument } from "../models/Case.js";
import { EvidenceModel } from "../models/Evidence.js";
import { GenerationJobModel } from "../models/GenerationJob.js";
import { SolutionModel } from "../models/Solution.js";
import { SuspectModel } from "../models/Suspect.js";
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
      const existing = await CaseModel.findOne({
        creatorSessionId: guestHash,
        idempotencyKey,
      }).exec();
      if (existing) {
        await this.getAccessibleCase(existing._id.toString(), guestHash);
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
      await this.persistSampleCase(instantiated, idempotencyKey ? guestHash : undefined);
    } catch (error) {
      if (idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await CaseModel.findOne({
          creatorSessionId: guestHash,
          idempotencyKey,
        }).exec();
        if (existing) {
          await this.getAccessibleCase(existing._id.toString(), guestHash);
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

    const persisted = await CaseModel.findById(instantiated.caseDoc._id).exec();
    if (!persisted) {
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The sample case could not be loaded after creation.",
      );
    }

    this.logger.info(
      {
        caseId: persisted._id.toString(),
        generationId: persisted.generationId.toString(),
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
      const existing = await CaseModel.findOne({
        creatorSessionId: guestHash,
        idempotencyKey,
      }).exec();
      if (existing) {
        return this.resolveExistingCustomCase(existing);
      }
    }

    const caseId = new Types.ObjectId();
    const generationId = new Types.ObjectId();
    const provider = this.config.aiProvider;

    try {
      await CaseModel.create({
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
      });

      await GenerationJobModel.create({
        _id: generationId,
        caseId,
        creatorSessionId: guestHash,
        status: "pending",
        stage: "queued",
        attempts: 0,
        provider,
        promptVersion: PROMPT_VERSION,
        message: "Brief accepted. Waiting for the generator.",
      });
    } catch (error) {
      await Promise.allSettled([
        CaseModel.deleteOne({ _id: caseId }).exec(),
        GenerationJobModel.deleteOne({ _id: generationId }).exec(),
      ]);

      if (idempotencyKey && isDuplicateKeyError(error)) {
        const existing = await CaseModel.findOne({
          creatorSessionId: guestHash,
          idempotencyKey,
        }).exec();
        if (existing) {
          return this.resolveExistingCustomCase(existing);
        }
      }

      this.logger.error(
        { err: error, caseId: caseId.toString() },
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

    const job = await GenerationJobModel.findById(generationId).exec();
    if (!job) {
      throw new AppError(
        500,
        "GENERATION_FAILED",
        "The case generation record could not be loaded.",
      );
    }

    this.logger.info(
      {
        caseId: caseId.toString(),
        generationId: generationId.toString(),
        provider,
      },
      "custom generation accepted",
    );

    return { kind: "accepted", generation: toGenerationStatusView(job) };
  }

  private async resolveExistingCustomCase(
    caseDoc: HydratedDocument<CaseDocument>,
  ): Promise<CreatedCustomCase> {
    const job = await GenerationJobModel.findById(caseDoc.generationId).exec();
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
      SuspectModel.find({ caseId: caseDoc._id }).exec(),
      EvidenceModel.countDocuments({ caseId: caseDoc._id }).exec(),
    ]);
    return toPublicCase(caseDoc, suspectDocs, evidenceCount);
  }

  async listEvidence(caseId: string, guestHash: string): Promise<EvidenceListView> {
    const caseDoc = await this.getAccessibleCase(caseId, guestHash);
    const evidenceDocs = await EvidenceModel.find({ caseId: caseDoc._id })
      .sort({ exhibitNumber: 1 })
      .exec();
    return toEvidenceListView(evidenceDocs);
  }

  async getEvidence(evidenceId: string, guestHash: string): Promise<EvidenceDetail> {
    const evidence = await EvidenceModel.findById(evidenceId).exec();
    if (!evidence) {
      throw new AppError(404, "EVIDENCE_NOT_FOUND", "That exhibit was not found.");
    }
    const caseDoc = await this.getAccessibleCase(evidence.caseId.toString(), guestHash);
    if (evidence.caseId.toString() !== caseDoc._id.toString()) {
      throw new AppError(404, "EVIDENCE_NOT_FOUND", "That exhibit was not found.");
    }
    return toEvidenceDetail(evidence, caseDoc.fictionNotice);
  }

  async getGenerationStatus(
    generationId: string,
    guestHash: string,
  ): Promise<GenerationStatusView> {
    const job = await GenerationJobModel.findById(generationId).exec();
    if (!job) {
      throw new AppError(404, "NOT_FOUND", "That generation record was not found.");
    }

    const caseDoc = await CaseModel.findById(job.caseId).exec();
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

  async getAccessibleCase(caseId: string, guestHash: string) {
    if (!Types.ObjectId.isValid(caseId)) {
      throw new AppError(404, "CASE_NOT_FOUND", "That case was not found.");
    }

    const caseDoc = await CaseModel.findById(caseId).exec();
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

  async getSolution(caseId: string) {
    const solution = await SolutionModel.findOne({ caseId }).exec();
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
    idempotencyOwner: string | undefined,
  ): Promise<void> {
    const { caseDoc, suspectDocs, evidenceDocs, solutionDoc } = instantiated;
    const insertedSuspectIds = suspectDocs.map((suspect) => suspect._id);
    const insertedEvidenceIds = evidenceDocs.map((evidence) => evidence._id);

    try {
      await SuspectModel.insertMany(suspectDocs);
      await EvidenceModel.insertMany(evidenceDocs);
      await SolutionModel.create(solutionDoc);
      await GenerationJobModel.create({
        _id: caseDoc.generationId,
        caseId: caseDoc._id,
        creatorSessionId: caseDoc.creatorSessionId,
        status: "validating",
        stage: "deterministic_validation_passed",
        attempts: 1,
        provider: "mock",
        promptVersion: "sample-v1",
      });
      await CaseModel.create(caseDoc);
      await CaseModel.updateOne(
        { _id: caseDoc._id, status: "validating" },
        { $set: { status: "ready" } },
      ).exec();
      await GenerationJobModel.updateOne(
        { _id: caseDoc.generationId },
        {
          $set: {
            status: "ready",
            stage: "published",
            completedAt: new Date(),
          },
        },
      ).exec();
    } catch (error) {
      this.logger.error(
        {
          err: error,
          caseId: caseDoc._id.toString(),
          idempotencyOwner: idempotencyOwner ? "present" : "none",
        },
        "cleaning up failed sample persistence",
      );
      await Promise.allSettled([
        CaseModel.deleteOne({ _id: caseDoc._id }).exec(),
        SolutionModel.deleteOne({ caseId: caseDoc._id }).exec(),
        GenerationJobModel.deleteOne({ _id: caseDoc.generationId }).exec(),
        EvidenceModel.deleteMany({ _id: { $in: insertedEvidenceIds } }).exec(),
        SuspectModel.deleteMany({ _id: { $in: insertedSuspectIds } }).exec(),
      ]);
      throw error;
    }
  }

  private async toCreatedView(
    caseDoc: HydratedDocument<CaseDocument>,
  ): Promise<CaseCreatedView> {
    const [suspectDocs, evidenceCount] = await Promise.all([
      SuspectModel.find({ caseId: caseDoc._id }).exec(),
      EvidenceModel.countDocuments({ caseId: caseDoc._id }).exec(),
    ]);
    return {
      case: toPublicCase(caseDoc, orderedSuspects(caseDoc, suspectDocs), evidenceCount),
      generationId: caseDoc.generationId.toString(),
      sample: caseDoc.isSample,
    };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
