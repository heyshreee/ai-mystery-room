import type { GenerationJobDocument, GenerationStatus } from "../models/GenerationJob.js";
import { getDatabase, type Database } from "../db/database.js";
import {
  asDate,
  asNumber,
  asOptionalDate,
  asOptionalString,
} from "./rows.js";

interface GenerationJobRow {
  id: string;
  case_id: string;
  creator_session_id: string;
  status: GenerationStatus;
  stage: string;
  attempts: number;
  provider: string;
  prompt_version: string;
  error_code: string | null;
  message: string | null;
  completed_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const JOB_COLUMNS = `
  id, case_id, creator_session_id, status, stage, attempts, provider,
  prompt_version, error_code, message, completed_at, created_at, updated_at
`;

function mapJob(row: GenerationJobRow): GenerationJobDocument {
  const errorCode = asOptionalString(row.error_code);
  const message = asOptionalString(row.message);
  const completedAt = asOptionalDate(row.completed_at);
  return {
    _id: row.id,
    caseId: row.case_id,
    creatorSessionId: row.creator_session_id,
    status: row.status,
    stage: row.stage,
    attempts: asNumber(row.attempts),
    provider: row.provider,
    promptVersion: row.prompt_version,
    ...(errorCode ? { errorCode } : {}),
    ...(message ? { message } : {}),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    ...(completedAt ? { completedAt } : {}),
  };
}

export async function insertGenerationJob(
  document: GenerationJobDocument,
  database: Database = getDatabase(),
): Promise<void> {
  await database.execute(
    `INSERT INTO amr.generation_jobs (${JOB_COLUMNS})
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       COALESCE($12::timestamptz, now()), COALESCE($13::timestamptz, now())
     )`,
    [
      document._id,
      document.caseId,
      document.creatorSessionId,
      document.status,
      document.stage,
      document.attempts,
      document.provider,
      document.promptVersion,
      document.errorCode ?? null,
      document.message ?? null,
      document.completedAt ?? null,
      document.createdAt ?? null,
      document.updatedAt ?? null,
    ],
  );
}

export async function findGenerationJobById(
  id: string,
  database: Database = getDatabase(),
): Promise<GenerationJobDocument | null> {
  const rows = await database.query<GenerationJobRow>(
    `SELECT ${JOB_COLUMNS} FROM amr.generation_jobs WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function findGenerationJobByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<GenerationJobDocument | null> {
  const rows = await database.query<GenerationJobRow>(
    `SELECT ${JOB_COLUMNS} FROM amr.generation_jobs WHERE case_id = $1`,
    [caseId],
  );
  return rows[0] ? mapJob(rows[0]) : null;
}

export interface GenerationJobUpdate {
  status?: GenerationStatus;
  stage?: string;
  attempts?: number;
  message?: string;
  errorCode?: string;
  completedAt?: Date;
}

export async function updateGenerationJob(
  id: string,
  patch: GenerationJobUpdate,
  database: Database = getDatabase(),
): Promise<number> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (patch.status !== undefined) add("status", patch.status);
  if (patch.stage !== undefined) add("stage", patch.stage);
  if (patch.attempts !== undefined) add("attempts", patch.attempts);
  if (patch.message !== undefined) add("message", patch.message);
  if (patch.errorCode !== undefined) add("error_code", patch.errorCode);
  if (patch.completedAt !== undefined) add("completed_at", patch.completedAt);

  if (sets.length === 0) {
    return 0;
  }
  sets.push("updated_at = now()");
  values.push(id);
  return database.execute(
    `UPDATE amr.generation_jobs SET ${sets.join(", ")} WHERE id = $${values.length}`,
    values,
  );
}

export async function findUnfinishedJobCaseIds(
  database: Database = getDatabase(),
): Promise<string[]> {
  const rows = await database.query<{ case_id: string }>(
    `SELECT case_id FROM amr.generation_jobs
     WHERE status = ANY($1::text[])`,
    [["pending", "validating"]],
  );
  return rows.map((row) => row.case_id);
}

export async function markJobsFailedByCaseIds(
  caseIds: readonly string[],
  errorCode: string,
  message: string,
  database: Database = getDatabase(),
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }
  return database.execute(
    `UPDATE amr.generation_jobs
     SET status = 'failed',
         stage = 'failed',
         error_code = $2,
         message = $3,
         completed_at = now(),
         updated_at = now()
     WHERE case_id = ANY($1::text[])
       AND status = ANY($4::text[])`,
    [[...caseIds], errorCode, message, ["pending", "validating"]],
  );
}

export async function deleteGenerationJobsByCaseIds(
  caseIds: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }
  return database.execute(
    "DELETE FROM amr.generation_jobs WHERE case_id = ANY($1::text[])",
    [[...caseIds]],
  );
}

export async function deleteGenerationJobById(
  id: string,
  database: Database = getDatabase(),
): Promise<number> {
  return database.execute("DELETE FROM amr.generation_jobs WHERE id = $1", [id]);
}
