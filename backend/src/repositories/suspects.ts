import type {
  SuspectDocument,
  SuspectRelationship,
} from "../models/Suspect.js";
import { getDatabase, type Database } from "../db/database.js";
import { asArray, asDate } from "./rows.js";

interface SuspectRow {
  id: string;
  case_id: string;
  display_name: string;
  role: string;
  profile: string;
  motive_summary: string;
  opportunity_summary: string;
  public_statement: string;
  relationships: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const SUSPECT_COLUMNS = `
  id, case_id, display_name, role, profile, motive_summary,
  opportunity_summary, public_statement, relationships, created_at, updated_at
`;

function mapSuspect(row: SuspectRow): SuspectDocument {
  return {
    _id: row.id,
    caseId: row.case_id,
    displayName: row.display_name,
    role: row.role,
    profile: row.profile,
    motiveSummary: row.motive_summary,
    opportunitySummary: row.opportunity_summary,
    publicStatement: row.public_statement,
    relationships: asArray<SuspectRelationship>(row.relationships),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

export async function insertSuspects(
  documents: readonly SuspectDocument[],
  database: Database = getDatabase(),
): Promise<void> {
  for (const document of documents) {
    await database.execute(
      `INSERT INTO amr.suspects (${SUSPECT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, COALESCE($10::timestamptz, now()), COALESCE($11::timestamptz, now()))`,
      [
        document._id,
        document.caseId,
        document.displayName,
        document.role,
        document.profile,
        document.motiveSummary,
        document.opportunitySummary,
        document.publicStatement,
        JSON.stringify(document.relationships),
        document.createdAt ?? null,
        document.updatedAt ?? null,
      ],
    );
  }
}

export async function findSuspectsByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<SuspectDocument[]> {
  const rows = await database.query<SuspectRow>(
    `SELECT ${SUSPECT_COLUMNS}
     FROM amr.suspects
     WHERE case_id = $1
     ORDER BY created_at ASC, id ASC`,
    [caseId],
  );
  return rows.map(mapSuspect);
}

export async function findSuspectByIdAndCaseId(
  id: string,
  caseId: string,
  database: Database = getDatabase(),
): Promise<SuspectDocument | null> {
  const rows = await database.query<SuspectRow>(
    `SELECT ${SUSPECT_COLUMNS}
     FROM amr.suspects
     WHERE id = $1 AND case_id = $2`,
    [id, caseId],
  );
  return rows[0] ? mapSuspect(rows[0]) : null;
}

export async function countSuspectsByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<number> {
  const rows = await database.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM amr.suspects WHERE case_id = $1",
    [caseId],
  );
  return rows[0]?.count ?? 0;
}

export async function deleteSuspectsByCaseIds(
  caseIds: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }
  return database.execute("DELETE FROM amr.suspects WHERE case_id = ANY($1::text[])", [
    [...caseIds],
  ]);
}

export async function deleteSuspectsByIds(
  ids: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  return database.execute("DELETE FROM amr.suspects WHERE id = ANY($1::text[])", [
    [...ids],
  ]);
}
