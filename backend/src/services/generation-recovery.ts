import type { Types } from "mongoose";
import { CaseModel } from "../models/Case.js";
import { EvidenceModel } from "../models/Evidence.js";
import { GenerationJobModel } from "../models/GenerationJob.js";
import { SolutionModel } from "../models/Solution.js";
import { SuspectModel } from "../models/Suspect.js";
import type { Logger } from "../utils/logger.js";

export const INTERRUPTED_GENERATION_MESSAGE =
  "The server restarted before this case finished. Submit the brief again to start a new attempt.";

export interface RecoveryResult {
  cases: number;
  jobs: number;
}

/**
 * Generation runs in-process, so a restart can leave a case and job marked as
 * pending. Before the API starts accepting traffic, fail those attempts and
 * remove any partially persisted suspects, evidence, or solution documents.
 *
 * This assumes one API process owns the database at startup. A multi-instance
 * deployment must move generation to a durable queue before using this recovery.
 */
export async function recoverInterruptedGenerations(
  logger: Logger,
): Promise<RecoveryResult> {
  const unfinishedCases = await CaseModel.find({
    status: { $in: ["generating", "validating"] },
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  const caseIds = unfinishedCases.map((entry) => entry._id as Types.ObjectId);
  if (caseIds.length === 0) {
    return { cases: 0, jobs: 0 };
  }

  await Promise.all([
    SuspectModel.deleteMany({ caseId: { $in: caseIds } }).exec(),
    EvidenceModel.deleteMany({ caseId: { $in: caseIds } }).exec(),
    SolutionModel.deleteMany({ caseId: { $in: caseIds } }).exec(),
  ]);

  const [caseUpdate, jobUpdate] = await Promise.all([
    CaseModel.updateMany(
      { _id: { $in: caseIds }, status: { $in: ["generating", "validating"] } },
      { $set: { status: "failed" } },
    ).exec(),
    GenerationJobModel.updateMany(
      {
        caseId: { $in: caseIds },
        status: { $in: ["pending", "validating"] },
      },
      {
        $set: {
          status: "failed",
          stage: "failed",
          errorCode: "GENERATION_FAILED",
          message: INTERRUPTED_GENERATION_MESSAGE,
          completedAt: new Date(),
        },
      },
    ).exec(),
  ]);

  const result = {
    cases: caseUpdate.modifiedCount,
    jobs: jobUpdate.modifiedCount,
  };
  logger.warn(result, "marked interrupted generations as failed after restart");
  return result;
}
