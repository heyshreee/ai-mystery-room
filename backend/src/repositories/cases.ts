import type { Category, Difficulty, PublicTimelineEvent } from "@amr/shared";
import type {
  CaseDocument,
  CaseIncident,
  CaseStatus,
} from "../models/Case.js";
import { getDatabase, type Database } from "../db/database.js";
import {
  asArray,
  asDate,
  asObject,
  asStringArray,
} from "./rows.js";

interface CaseRow {
  id: string;
  title: string;
  scenario: string;
  summary: string;
  category: Category;
  difficulty: Difficulty;
  status: CaseStatus;
  creator_session_id: string;
  suspect_ids: unknown;
  evidence_ids: unknown;
  generation_version: string;
  generation_id: string;
  idempotency_key: string | null;
  is_sample: boolean;
  is_public: boolean;
  incident: unknown;
  timezone: string;
  case_rules: unknown;
  fiction_notice: string;
  timeline: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const CASE_COLUMNS = `
  id, title, scenario, summary, category, difficulty, status,
  creator_session_id, suspect_ids, evidence_ids, generation_version,
  generation_id, idempotency_key, is_sample, is_public, incident,
  timezone, case_rules, fiction_notice, timeline, created_at, updated_at
`;

function mapCase(row: CaseRow): CaseDocument {
  return {
    _id: row.id,
    title: row.title,
    scenario: row.scenario,
    summary: row.summary,
    category: row.category,
    difficulty: row.difficulty,
    status: row.status,
    creatorSessionId: row.creator_session_id,
    suspectIds: asStringArray(row.suspect_ids),
    evidenceIds: asStringArray(row.evidence_ids),
    generationVersion: row.generation_version,
    generationId: row.generation_id,
    ...(row.idempotency_key ? { idempotencyKey: row.idempotency_key } : {}),
    isSample: row.is_sample,
    isPublic: row.is_public,
    incident: asObject<CaseIncident>(row.incident, {
      location: "",
      occurredAt: new Date(0).toISOString(),
      description: "",
    }),
    timezone: row.timezone,
    caseRules: asStringArray(row.case_rules),
    fictionNotice: row.fiction_notice,
    timeline: asArray<PublicTimelineEvent>(row.timeline),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

export async function insertCase(
  document: CaseDocument,
  database: Database = getDatabase(),
): Promise<void> {
  await database.execute(
    `INSERT INTO amr.cases (${CASE_COLUMNS})
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11,
       $12, $13, $14, $15, $16::jsonb, $17, $18::jsonb, $19, $20::jsonb,
       COALESCE($21::timestamptz, now()), COALESCE($22::timestamptz, now())
     )`,
    [
      document._id,
      document.title,
      document.scenario,
      document.summary,
      document.category,
      document.difficulty,
      document.status,
      document.creatorSessionId,
      JSON.stringify(document.suspectIds),
      JSON.stringify(document.evidenceIds),
      document.generationVersion,
      document.generationId,
      document.idempotencyKey ?? null,
      document.isSample,
      document.isPublic,
      JSON.stringify(document.incident),
      document.timezone,
      JSON.stringify(document.caseRules),
      document.fictionNotice,
      JSON.stringify(document.timeline),
      document.createdAt ?? null,
      document.updatedAt ?? null,
    ],
  );
}

export async function findCaseById(
  id: string,
  database: Database = getDatabase(),
): Promise<CaseDocument | null> {
  const rows = await database.query<CaseRow>(
    `SELECT ${CASE_COLUMNS} FROM amr.cases WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapCase(rows[0]) : null;
}

export async function findCaseByCreatorAndIdempotency(
  creatorSessionId: string,
  idempotencyKey: string,
  database: Database = getDatabase(),
): Promise<CaseDocument | null> {
  const rows = await database.query<CaseRow>(
    `SELECT ${CASE_COLUMNS}
     FROM amr.cases
     WHERE creator_session_id = $1 AND idempotency_key = $2`,
    [creatorSessionId, idempotencyKey],
  );
  return rows[0] ? mapCase(rows[0]) : null;
}

export interface CaseUpdate {
  title?: string;
  scenario?: string;
  summary?: string;
  category?: Category;
  difficulty?: Difficulty;
  status?: CaseStatus;
  suspectIds?: string[];
  evidenceIds?: string[];
  generationVersion?: string;
  isPublic?: boolean;
  incident?: CaseIncident;
  timezone?: string;
  caseRules?: string[];
  fictionNotice?: string;
  timeline?: PublicTimelineEvent[];
}

function buildUpdate(patch: CaseUpdate): { sets: string[]; values: unknown[] } {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  const addJson = (column: string, value: unknown): void => {
    values.push(JSON.stringify(value));
    sets.push(`${column} = $${values.length}::jsonb`);
  };

  if (patch.title !== undefined) add("title", patch.title);
  if (patch.scenario !== undefined) add("scenario", patch.scenario);
  if (patch.summary !== undefined) add("summary", patch.summary);
  if (patch.category !== undefined) add("category", patch.category);
  if (patch.difficulty !== undefined) add("difficulty", patch.difficulty);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.suspectIds !== undefined) addJson("suspect_ids", patch.suspectIds);
  if (patch.evidenceIds !== undefined) addJson("evidence_ids", patch.evidenceIds);
  if (patch.generationVersion !== undefined) {
    add("generation_version", patch.generationVersion);
  }
  if (patch.isPublic !== undefined) add("is_public", patch.isPublic);
  if (patch.incident !== undefined) addJson("incident", patch.incident);
  if (patch.timezone !== undefined) add("timezone", patch.timezone);
  if (patch.caseRules !== undefined) addJson("case_rules", patch.caseRules);
  if (patch.fictionNotice !== undefined) add("fiction_notice", patch.fictionNotice);
  if (patch.timeline !== undefined) addJson("timeline", patch.timeline);

  return { sets, values };
}

export async function updateCase(
  id: string,
  patch: CaseUpdate,
  database: Database = getDatabase(),
): Promise<number> {
  const { sets, values } = buildUpdate(patch);
  if (sets.length === 0) {
    return 0;
  }
  sets.push("updated_at = now()");
  const idParameter = values.length + 1;
  return database.execute(
    `UPDATE amr.cases SET ${sets.join(", ")} WHERE id = $${idParameter}`,
    [...values, id],
  );
}

export async function updateCaseIfStatus(
  id: string,
  allowedStatuses: readonly CaseStatus[],
  patch: CaseUpdate,
  database: Database = getDatabase(),
): Promise<number> {
  const { sets, values } = buildUpdate(patch);
  if (sets.length === 0) {
    return 0;
  }
  sets.push("updated_at = now()");
  const idParameter = values.length + 1;
  const statusesParameter = values.length + 2;
  return database.execute(
    `UPDATE amr.cases
     SET ${sets.join(", ")}
     WHERE id = $${idParameter} AND status = ANY($${statusesParameter}::text[])`,
    [...values, id, [...allowedStatuses]],
  );
}

export async function markCasesFailed(
  ids: readonly string[],
  allowedStatuses: readonly CaseStatus[],
  database: Database = getDatabase(),
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  return database.execute(
    `UPDATE amr.cases
     SET status = 'failed', updated_at = now()
     WHERE id = ANY($1::text[]) AND status = ANY($2::text[])`,
    [[...ids], [...allowedStatuses]],
  );
}

export async function findUnfinishedCaseIds(
  database: Database = getDatabase(),
): Promise<string[]> {
  const rows = await database.query<{ id: string }>(
    `SELECT id FROM amr.cases WHERE status = ANY($1::text[])`,
    [["generating", "validating"]],
  );
  return rows.map((row) => row.id);
}

export async function countCases(
  filter: { isSample?: boolean } = {},
  database: Database = getDatabase(),
): Promise<number> {
  const rows = await database.query<{ count: number }>(
    filter.isSample === undefined
      ? "SELECT count(*)::int AS count FROM amr.cases"
      : "SELECT count(*)::int AS count FROM amr.cases WHERE is_sample = $1",
    filter.isSample === undefined ? [] : [filter.isSample],
  );
  return rows[0]?.count ?? 0;
}

export async function deleteAllCases(database: Database = getDatabase()): Promise<number> {
  return database.execute("DELETE FROM amr.cases");
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
