import { Types } from "mongoose";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { CaseModel } from "../models/Case.js";
import { EvidenceModel } from "../models/Evidence.js";
import { GenerationJobModel } from "../models/GenerationJob.js";
import { SolutionModel } from "../models/Solution.js";
import { SuspectModel } from "../models/Suspect.js";
import {
  caseBlueprintSchema,
  type CaseBlueprint,
} from "../generation/blueprint.js";
import { buildGeneratedCaseDocuments } from "../generation/mapper.js";
import {
  BLUEPRINT_SCHEMA_NAME,
  PROMPT_VERSION,
  buildGenerationPrompts,
} from "../generation/prompt.js";
import {
  ProviderError,
  type AIProvider,
  type GenerationRequest,
} from "../generation/types.js";
import { validateCaseStructure } from "./case-validation.js";

export interface GenerationInput {
  caseId: Types.ObjectId;
  generationId: Types.ObjectId;
  creatorSessionId: string;
  request: GenerationRequest;
}

export interface GenerationServiceDependencies {
  config: AppConfig;
  logger: Logger;
  aiProvider: AIProvider;
}

interface FailureDescription {
  code: "GENERATION_FAILED" | "GENERATION_TIMEOUT" | "AI_PROVIDER_UNAVAILABLE" | "INVALID_AI_OUTPUT";
  message: string;
}

/**
 * Runs generation jobs in-process. The HTTP request returns a generation ID and
 * the client polls the status endpoint. This is a real background task for a
 * single long-running Node process; a durable queue is required before running
 * multiple API replicas or relying on jobs surviving a restart.
 */
export class GenerationService {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly aiProvider: AIProvider;
  private readonly activeTasks = new Set<Promise<void>>();

  constructor({ config, logger, aiProvider }: GenerationServiceDependencies) {
    this.config = config;
    this.logger = logger;
    this.aiProvider = aiProvider;
  }

  start(input: GenerationInput): void {
    const task = this.run(input).catch((error: unknown) => {
      this.logger.error(
        {
          err: error,
          caseId: input.caseId.toString(),
          generationId: input.generationId.toString(),
        },
        "generation worker failed unexpectedly",
      );
    });
    this.activeTasks.add(task);
    void task.finally(() => {
      this.activeTasks.delete(task);
    });
  }

  async waitForIdle(): Promise<void> {
    while (this.activeTasks.size > 0) {
      await Promise.allSettled([...this.activeTasks]);
    }
  }

  private async run(input: GenerationInput): Promise<void> {
    const startedAt = Date.now();
    const { caseId, generationId, request } = input;
    let stage = "normalizing_brief";

    try {
      await this.updateJob(generationId, {
        status: "pending",
        stage,
        message: "Normalizing the case brief.",
      });

      const prompts = buildGenerationPrompts(request);
      let userPrompt = prompts.userPrompt;
      let lastFailure: FailureDescription | undefined;

      for (let attempt = 1; attempt <= this.config.maxGenerationAttempts; attempt += 1) {
        stage = attempt === 1 ? "drafting_blueprint" : "repairing_blueprint";
        await this.updateJob(generationId, {
          status: "pending",
          stage,
          attempts: attempt,
          message:
            attempt === 1
              ? "Drafting the case blueprint."
              : "Repairing the blueprint after a validation issue.",
        });

        let blueprintValue: unknown;
        try {
          blueprintValue = await this.aiProvider.generateStructured({
            systemPrompt: prompts.systemPrompt,
            userPrompt,
            schemaName: BLUEPRINT_SCHEMA_NAME,
            schema: prompts.schema,
            timeoutMs: this.config.aiTimeoutMs,
            temperature: 0.4,
            context: request,
          });
        } catch (error) {
          const failure = failureFromProvider(error);
          lastFailure = failure;
          this.logger.warn(
            {
              caseId: caseId.toString(),
              generationId: generationId.toString(),
              provider: this.aiProvider.id,
              attempt,
              errorCode: failure.code,
              durationMs: Date.now() - startedAt,
            },
            "generation provider attempt failed",
          );
          if (
            error instanceof ProviderError &&
            error.retryable &&
            attempt < this.config.maxGenerationAttempts
          ) {
            continue;
          }
          await this.fail(input, failure, stage);
          return;
        }

        const parsed = caseBlueprintSchema.safeParse(blueprintValue);
        if (!parsed.success) {
          const issues = parsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "blueprint"}: ${issue.message}`,
          );
          this.logger.warn(
            {
              caseId: caseId.toString(),
              generationId: generationId.toString(),
              provider: this.aiProvider.id,
              attempt,
              issueCount: issues.length,
              issues: issues.slice(0, 12).map(sanitizeValidationIssue),
            },
            "generated blueprint failed schema validation",
          );
          lastFailure = {
            code: "INVALID_AI_OUTPUT",
            message:
              "The generated case did not pass structural validation. Please try again.",
          };
          if (attempt < this.config.maxGenerationAttempts) {
            userPrompt = `${prompts.userPrompt}\n\nPrevious attempt failed validation. Correct these issues without adding commentary:\n${issues.slice(0, 12).join("\n")}`;
            continue;
          }
          await this.fail(input, lastFailure, stage);
          return;
        }

        const alignmentIssues = validateRequestAlignment(parsed.data, request);
        if (alignmentIssues.length > 0) {
          this.logger.warn(
            {
              caseId: caseId.toString(),
              generationId: generationId.toString(),
              provider: this.aiProvider.id,
              attempt,
              issues: alignmentIssues.map(sanitizeValidationIssue),
            },
            "generated blueprint failed brief alignment validation",
          );
          lastFailure = {
            code: "INVALID_AI_OUTPUT",
            message:
              "The generated case did not match the submitted brief closely enough. Please try again.",
          };
          if (attempt < this.config.maxGenerationAttempts) {
            userPrompt = `${prompts.userPrompt}\n\nPrevious attempt failed brief-alignment validation. Correct these issues without adding commentary:\n${alignmentIssues.join("\n")}`;
            continue;
          }
          await this.fail(input, lastFailure, stage);
          return;
        }

        stage = "validating_case";
        await this.updateJob(generationId, {
          status: "validating",
          stage,
          attempts: attempt,
          message: "Checking the timeline, suspects, clues, and solution.",
        });

        const documents = buildGeneratedCaseDocuments({
          blueprint: parsed.data,
          request,
          caseId,
          generationId,
          creatorSessionId: input.creatorSessionId,
          provider: this.aiProvider.id,
          hintLimit: this.config.hintLimit,
        });

        const validation = validateCaseStructure(documents);
        if (!validation.valid) {
          const issues = validation.issues.map(
            (issue) => `${issue.code}: ${issue.message}`,
          );
          this.logger.warn(
            {
              caseId: caseId.toString(),
              generationId: generationId.toString(),
              provider: this.aiProvider.id,
              attempt,
              issues: issues.slice(0, 16).map(sanitizeValidationIssue),
            },
            "generated case failed deterministic validation",
          );
          lastFailure = {
            code: "INVALID_AI_OUTPUT",
            message:
              "The generated case did not pass consistency checks. Please try again.",
          };
          if (attempt < this.config.maxGenerationAttempts) {
            userPrompt = `${prompts.userPrompt}\n\nPrevious attempt failed deterministic consistency checks. Correct these issues without adding commentary:\n${issues.slice(0, 16).join("\n")}`;
            continue;
          }
          await this.fail(input, lastFailure, stage);
          return;
        }

        stage = "publishing";
        await this.updateJob(generationId, {
          status: "validating",
          stage,
          attempts: attempt,
          message: "Publishing the validated case file.",
        });

        try {
          await this.persist(documents);
        } catch (error) {
          this.logger.error(
            {
              err: error,
              caseId: caseId.toString(),
              generationId: generationId.toString(),
              provider: this.aiProvider.id,
              durationMs: Date.now() - startedAt,
            },
            "generated case persistence failed",
          );
          await this.cleanup(caseId);
          await this.fail(
            input,
            {
              code: "GENERATION_FAILED",
              message:
                "The case passed validation but could not be saved. Please try again.",
            },
            stage,
          );
          return;
        }

        await GenerationJobModel.updateOne(
          { _id: generationId },
          {
            $set: {
              status: "ready",
              stage: "published",
              message: "The case file is ready.",
              completedAt: new Date(),
            },
          },
        ).exec();

        this.logger.info(
          {
            caseId: caseId.toString(),
            generationId: generationId.toString(),
            provider: this.aiProvider.id,
            attempts: attempt,
            durationMs: Date.now() - startedAt,
            suspects: documents.suspectDocs.length,
            evidence: documents.evidenceDocs.length,
          },
          "generated case published",
        );
        return;
      }

      await this.fail(
        input,
        lastFailure ?? {
          code: "GENERATION_FAILED",
          message: "The case could not be generated. Please try again.",
        },
        stage,
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          caseId: caseId.toString(),
          generationId: generationId.toString(),
          provider: this.aiProvider.id,
          stage,
          durationMs: Date.now() - startedAt,
        },
        "generation job failed unexpectedly",
      );
      await this.cleanup(caseId);
      await this.fail(
        input,
        {
          code: "GENERATION_FAILED",
          message: "The case could not be generated. Please try again.",
        },
        stage,
      );
    }
  }

  private async persist(
    documents: ReturnType<typeof buildGeneratedCaseDocuments>,
  ): Promise<void> {
    const { caseDoc, suspectDocs, evidenceDocs, solutionDoc } = documents;
    const { _id: caseId, ...caseFields } = caseDoc;

    await SuspectModel.insertMany(suspectDocs);
    await EvidenceModel.insertMany(evidenceDocs);
    await SolutionModel.create({ ...solutionDoc, validationStatus: "valid" });

    const updated = await CaseModel.updateOne(
      { _id: caseId, status: { $in: ["generating", "validating"] } },
      { $set: { ...caseFields, status: "validating" } },
    ).exec();
    if (updated.matchedCount === 0) {
      throw new Error("The case could not be updated during publication.");
    }

    await CaseModel.updateOne(
      { _id: caseId, status: "validating" },
      { $set: { status: "ready" } },
    ).exec();
  }

  private async fail(
    input: GenerationInput,
    failure: FailureDescription,
    stage: string,
  ): Promise<void> {
    await this.cleanup(input.caseId);
    await Promise.allSettled([
      CaseModel.updateOne(
        { _id: input.caseId },
        { $set: { status: "failed" } },
      ).exec(),
      GenerationJobModel.updateOne(
        { _id: input.generationId },
        {
          $set: {
            status: "failed",
            stage: "failed",
            errorCode: failure.code,
            message: failure.message,
            completedAt: new Date(),
          },
        },
      ).exec(),
    ]);
    this.logger.info(
      {
        caseId: input.caseId.toString(),
        generationId: input.generationId.toString(),
        provider: this.aiProvider.id,
        stage,
        errorCode: failure.code,
      },
      "generation job marked failed",
    );
  }

  private async cleanup(caseId: Types.ObjectId): Promise<void> {
    await Promise.allSettled([
      SuspectModel.deleteMany({ caseId }).exec(),
      EvidenceModel.deleteMany({ caseId }).exec(),
      SolutionModel.deleteMany({ caseId }).exec(),
    ]);
  }

  private async updateJob(
    generationId: Types.ObjectId,
    update: {
      status: "pending" | "validating";
      stage: string;
      attempts?: number;
      message: string;
    },
  ): Promise<void> {
    await GenerationJobModel.updateOne(
      { _id: generationId },
      {
        $set: {
          status: update.status,
          stage: update.stage,
          message: update.message,
          ...(update.attempts ? { attempts: update.attempts } : {}),
        },
      },
    ).exec();
  }
}

function validateRequestAlignment(
  blueprint: CaseBlueprint,
  request: GenerationRequest,
): string[] {
  const issues: string[] = [];
  if (blueprint.category !== request.category) {
    issues.push(
      `category: expected "${request.category}", received "${blueprint.category}"`,
    );
  }
  if (blueprint.difficulty !== request.difficulty) {
    issues.push(
      `difficulty: expected "${request.difficulty}", received "${blueprint.difficulty}"`,
    );
  }

  const incidentTime = Date.parse(blueprint.incident.occurredAt);
  const firstEventTime = Math.min(
    ...blueprint.publicTimeline.map((event) => Date.parse(event.at)),
  );
  const lastEventTime = Math.max(
    ...blueprint.publicTimeline.map((event) => Date.parse(event.at)),
  );
  if (incidentTime < firstEventTime || incidentTime > lastEventTime) {
    issues.push(
      "incident.occurredAt: the incident must fall inside the public timeline window",
    );
  }

  const scenarioWords = significantWords(request.scenario);
  if (scenarioWords.length > 0) {
    const publicText = [
      blueprint.title,
      blueprint.summary,
      blueprint.incident.description,
      ...blueprint.publicTimeline.map((event) => event.description),
      ...blueprint.evidence.map((evidence) => evidence.publicDescription),
    ]
      .join(" ")
      .toLowerCase();
    if (!scenarioWords.some((word) => publicText.includes(word))) {
      issues.push(
        "summary: the generated case does not reference the submitted scenario closely enough",
      );
    }
  }

  return issues;
}

function significantWords(value: string): string[] {
  const stopwords = new Set([
    "about",
    "after",
    "again",
    "against",
    "during",
    "from",
    "into",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "through",
    "under",
    "when",
    "where",
    "which",
    "while",
    "with",
    "would",
    "private",
    "vanishes",
    "vanished",
    "locked",
  ]);
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter(
          (word) =>
            word.length >= 4 &&
            !stopwords.has(word) &&
            !/^\d+$/.test(word),
        ),
    ),
  ].slice(0, 40);
}

function failureFromProvider(error: unknown): FailureDescription {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case "GENERATION_TIMEOUT":
        return {
          code: "GENERATION_TIMEOUT",
          message:
            "The AI provider did not respond before the configured timeout. Please try again.",
        };
      case "AI_PROVIDER_UNAVAILABLE":
        return {
          code: "AI_PROVIDER_UNAVAILABLE",
          message:
            "The AI provider is unavailable. Check the provider configuration or play the sample case.",
        };
      case "INVALID_AI_OUTPUT":
        return {
          code: "INVALID_AI_OUTPUT",
          message:
            "The AI provider returned output that could not be validated. Please try again.",
        };
      default:
        break;
    }
  }
  return {
    code: "GENERATION_FAILED",
    message: "The case could not be generated. Please try again.",
  };
}

function sanitizeValidationIssue(value: string): string {
  return value
    // Strip control characters before logging or returning provider details.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

export const GENERATION_PROMPT_VERSION = PROMPT_VERSION;
