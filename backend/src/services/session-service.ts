import type { HydratedDocument } from "mongoose";
import type {
  GameSessionView,
  HintView,
  ResultView,
} from "@amr/shared";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { AppError } from "../utils/errors.js";
import { generateOpaqueToken, sessionTokenHash } from "../utils/hash.js";
import type { SessionCredential } from "../middleware/identity.js";
import { CaseModel } from "../models/Case.js";
import { EvidenceModel } from "../models/Evidence.js";
import { GameSessionModel, type GameSessionDocument } from "../models/GameSession.js";
import { SolutionModel, type SolutionDocument } from "../models/Solution.js";
import { SuspectModel } from "../models/Suspect.js";
import type { CaseService } from "./case-service.js";
import { calculateScore } from "./scoring.js";
import { toResultView, toSessionView } from "./presenters.js";

export interface SessionServiceDependencies {
  config: AppConfig;
  logger: Logger;
  caseService: CaseService;
}

export interface CreatedSession {
  session: GameSessionView;
  sessionToken: string;
}

const ACCUSATION_RETRY_LIMIT = 3;

export class SessionService {
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly caseService: CaseService;

  constructor({ config, logger, caseService }: SessionServiceDependencies) {
    this.config = config;
    this.logger = logger;
    this.caseService = caseService;
  }

  async createSession(caseId: string, guestHash: string): Promise<CreatedSession> {
    const caseDoc = await this.caseService.getAccessibleCase(caseId, guestHash);
    const sessionToken = generateOpaqueToken();
    const now = new Date();
    const session = await GameSessionModel.create({
      caseId: caseDoc._id,
      guestTokenHash: sessionTokenHash(this.config.sessionSecret, sessionToken),
      status: "investigating",
      viewedEvidenceIds: [],
      hintsUsed: 0,
      startedAt: now,
      expiresAt: new Date(now.getTime() + this.config.sessionTtlMs),
    });

    this.logger.info(
      {
        sessionId: session._id.toString(),
        caseId: caseDoc._id.toString(),
      },
      "game session created",
    );

    return {
      session: toSessionView(session, this.config.hintLimit),
      sessionToken,
    };
  }

  async getSession(
    sessionId: string,
    credential: SessionCredential | undefined,
  ): Promise<GameSessionView> {
    const session = await this.authenticate(sessionId, credential);
    return toSessionView(session, this.config.hintLimit);
  }

  async recordViewedEvidence(
    sessionId: string,
    credential: SessionCredential | undefined,
    evidenceId: string,
  ): Promise<GameSessionView> {
    const session = await this.authenticate(sessionId, credential);
    this.assertInvestigating(session);

    const evidence = await EvidenceModel.findOne({
      _id: evidenceId,
      caseId: session.caseId,
    }).exec();
    if (!evidence) {
      throw new AppError(404, "EVIDENCE_NOT_FOUND", "That exhibit was not found.");
    }

    const updated = await GameSessionModel.findOneAndUpdate(
      {
        _id: session._id,
        guestTokenHash: session.guestTokenHash,
        status: "investigating",
        expiresAt: { $gt: new Date() },
      },
      { $addToSet: { viewedEvidenceIds: evidence._id } },
      { returnDocument: "after" },
    ).exec();

    if (!updated) {
      const latest = await this.authenticate(sessionId, credential);
      this.assertInvestigating(latest);
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "The evidence view could not be recorded.",
      );
    }

    return toSessionView(updated, this.config.hintLimit);
  }

  async requestHint(
    sessionId: string,
    credential: SessionCredential | undefined,
  ): Promise<HintView> {
    const session = await this.authenticate(sessionId, credential);
    this.assertInvestigating(session);

    if (session.hintsUsed >= this.config.hintLimit) {
      throw hintLimitError();
    }

    const updated = await GameSessionModel.findOneAndUpdate(
      {
        _id: session._id,
        guestTokenHash: session.guestTokenHash,
        status: "investigating",
        expiresAt: { $gt: new Date() },
        hintsUsed: { $lt: this.config.hintLimit },
      },
      { $inc: { hintsUsed: 1 } },
      { returnDocument: "after" },
    ).exec();

    if (!updated) {
      const latest = await this.authenticate(sessionId, credential);
      this.assertInvestigating(latest);
      if (latest.hintsUsed >= this.config.hintLimit) {
        throw hintLimitError();
      }
      throw new AppError(500, "INTERNAL_ERROR", "The hint could not be recorded.");
    }

    const solution = await SolutionModel.findOne({ caseId: updated.caseId }).exec();
    const hint = solution?.hintTexts[updated.hintsUsed - 1];
    if (!solution || !hint) {
      this.logger.error(
        { sessionId: updated._id.toString(), hintsUsed: updated.hintsUsed },
        "hint text missing for validated case",
      );
      throw new AppError(500, "INTERNAL_ERROR", "The hint is unavailable.");
    }

    return {
      hint,
      hintsUsed: updated.hintsUsed,
      hintLimit: this.config.hintLimit,
      hintsRemaining: Math.max(0, this.config.hintLimit - updated.hintsUsed),
    };
  }

  async submitAccusation(
    sessionId: string,
    credential: SessionCredential | undefined,
    suspectId: string,
  ): Promise<ResultView> {
    const initialSession = await this.authenticate(sessionId, credential);
    this.assertInvestigating(initialSession);

    const suspect = await SuspectModel.findOne({
      _id: suspectId,
      caseId: initialSession.caseId,
    }).exec();
    if (!suspect) {
      throw new AppError(
        400,
        "INVALID_ACCUSATION",
        "The selected suspect is not part of this case.",
      );
    }

    const solution = await this.caseService.getSolution(initialSession.caseId.toString());
    const isCorrect = solution.culpritSuspectId.equals(suspect._id);

    let session = initialSession;
    for (let attempt = 0; attempt < ACCUSATION_RETRY_LIMIT; attempt += 1) {
      const score = calculateScore(isCorrect, session.hintsUsed);
      const now = new Date();
      const updated = await GameSessionModel.findOneAndUpdate(
        {
          _id: session._id,
          guestTokenHash: session.guestTokenHash,
          status: "investigating",
          hintsUsed: session.hintsUsed,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "completed",
            accusationSuspectId: suspect._id,
            isCorrect,
            score: score.total,
            scoreBreakdown: score,
            completedAt: now,
          },
        },
        { returnDocument: "after" },
      ).exec();

      if (updated) {
        this.logger.info(
          {
            sessionId: updated._id.toString(),
            caseId: updated.caseId.toString(),
            correct: isCorrect,
            score: score.total,
            hintsUsed: updated.hintsUsed,
          },
          "accusation finalized",
        );
        return this.buildResult(updated, solution);
      }

      const latest = await this.authenticate(sessionId, credential);
      if (latest.status === "completed") {
        throw new AppError(
          409,
          "SESSION_COMPLETED",
          "This case file is already closed. The final accusation cannot be changed.",
        );
      }
      this.assertInvestigating(latest);

      if (latest.hintsUsed !== session.hintsUsed) {
        session = latest;
        continue;
      }

      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "The accusation could not be finalized. Please try again.",
      );
    }

    throw new AppError(
      500,
      "INTERNAL_ERROR",
      "The accusation could not be finalized. Please try again.",
    );
  }

  async getResults(
    sessionId: string,
    credential: SessionCredential | undefined,
  ): Promise<ResultView> {
    const session = await this.authenticate(sessionId, credential);
    if (session.status !== "completed") {
      throw new AppError(
        409,
        "RESULT_NOT_AVAILABLE",
        "The solution is only available after a final accusation.",
      );
    }

    const solution = await this.caseService.getSolution(session.caseId.toString());
    return this.buildResult(session, solution);
  }

  private async authenticate(
    sessionId: string,
    credential: SessionCredential | undefined,
  ): Promise<GameSessionDocument> {
    if (!credential || credential.sessionId !== sessionId) {
      throw sessionNotFoundError();
    }

    const session = await GameSessionModel.findOne({
      _id: sessionId,
      guestTokenHash: sessionTokenHash(this.config.sessionSecret, credential.token),
    }).exec();

    if (!session) {
      throw sessionNotFoundError();
    }

    if (session.status === "expired" || session.expiresAt.getTime() <= Date.now()) {
      if (session.status !== "expired") {
        await GameSessionModel.updateOne(
          { _id: session._id, status: { $ne: "expired" } },
          { $set: { status: "expired" } },
        ).exec();
      }
      throw new AppError(
        410,
        "SESSION_EXPIRED",
        "This investigation session has expired. Start a new session to continue.",
      );
    }

    return session;
  }

  private assertInvestigating(session: GameSessionDocument): void {
    if (session.status === "completed") {
      throw new AppError(
        409,
        "SESSION_COMPLETED",
        "This case file is already closed. The final accusation cannot be changed.",
      );
    }
    if (session.status === "expired") {
      throw new AppError(
        410,
        "SESSION_EXPIRED",
        "This investigation session has expired. Start a new session to continue.",
      );
    }
  }

  private async buildResult(
    session: GameSessionDocument,
    solution: HydratedDocument<SolutionDocument>,
  ): Promise<ResultView> {
    if (!session.completedAt || !session.accusationSuspectId) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "The completed session is missing its accusation.",
      );
    }

    const [caseDoc, suspects, selected, supportingEvidence] = await Promise.all([
      CaseModel.findById(session.caseId).exec(),
      SuspectModel.find({ caseId: session.caseId }).exec(),
      SuspectModel.findOne({
        _id: session.accusationSuspectId,
        caseId: session.caseId,
      }).exec(),
      EvidenceModel.find({
        _id: { $in: solution.supportingEvidenceIds },
        caseId: session.caseId,
      }).exec(),
    ]);

    const culprit = suspects.find((suspect) =>
      suspect._id.equals(solution.culpritSuspectId),
    );

    if (!caseDoc || !culprit || !selected) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "The case result is incomplete.",
      );
    }

    const evidenceById = new Map(
      supportingEvidence.map((evidence) => [evidence._id.toString(), evidence] as const),
    );
    const orderedSupportingEvidence = solution.supportingEvidenceIds
      .map((id) => evidenceById.get(id.toString()))
      .filter((evidence): evidence is (typeof supportingEvidence)[number] =>
        Boolean(evidence),
      );

    return toResultView({
      session,
      caseDoc,
      solution,
      culprit,
      suspects,
      selected,
      supportingEvidence: orderedSupportingEvidence,
    });
  }
}

function sessionNotFoundError(): AppError {
  return new AppError(
    404,
    "SESSION_NOT_FOUND",
    "That investigation session was not found.",
  );
}

function hintLimitError(): AppError {
  return new AppError(
    409,
    "HINT_LIMIT_REACHED",
    "All available hints for this session have been used.",
  );
}
