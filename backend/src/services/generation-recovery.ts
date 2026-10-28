import { getDatabase } from "../db/database.js";
import { markCasesFailed, findUnfinishedCaseIds } from "../repositories/cases.js";
import { deleteEvidenceByCaseIds } from "../repositories/evidence.js";
import { markJobsFailedByCaseIds } from "../repositories/generation-jobs.js";
import { deleteSolutionsByCaseIds } from "../repositories/solutions.js";
import { deleteSuspectsByCaseIds } from "../repositories/suspects.js";
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
  const caseIds = await findUnfinishedCaseIds();
  if (caseIds.length === 0) {
    return { cases: 0, jobs: 0 };
  }

  const result = await getDatabase().transaction(async (database) => {
    await deleteSuspectsByCaseIds(caseIds, database);
    await deleteEvidenceByCaseIds(caseIds, database);
    await deleteSolutionsByCaseIds(caseIds, database);

    const cases = await markCasesFailed(caseIds, ["generating", "validating"], database);
    const jobs = await markJobsFailedByCaseIds(
      caseIds,
      "GENERATION_FAILED",
      INTERRUPTED_GENERATION_MESSAGE,
      database,
    );

    return { cases, jobs };
  });

  logger.warn(result, "marked interrupted generations as failed after restart");
  return result;
}
