import type { CanonicalTimelineEvent, SolutionDocument } from "../models/Solution.js";
import { getDatabase, type Database } from "../db/database.js";
import { asArray, asDate, asStringArray } from "./rows.js";

interface SolutionRow {
  id: string;
  case_id: string;
  culprit_suspect_id: string;
  canonical_timeline: unknown;
  motive: string;
  method: string;
  explanation: string;
  supporting_evidence_ids: unknown;
  hint_texts: unknown;
  validation_status: "pending" | "valid" | "invalid";
  content_safety_flags: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const SOLUTION_COLUMNS = `
  id, case_id, culprit_suspect_id, canonical_timeline, motive, method,
  explanation, supporting_evidence_ids, hint_texts, validation_status,
  content_safety_flags, created_at, updated_at
`;

function mapSolution(row: SolutionRow): SolutionDocument {
  return {
    _id: row.id,
    caseId: row.case_id,
    culpritSuspectId: row.culprit_suspect_id,
    canonicalTimeline: asArray<CanonicalTimelineEvent>(row.canonical_timeline),
    motive: row.motive,
    method: row.method,
    explanation: row.explanation,
    supportingEvidenceIds: asStringArray(row.supporting_evidence_ids),
    hintTexts: asStringArray(row.hint_texts),
    validationStatus: row.validation_status,
    contentSafetyFlags: asStringArray(row.content_safety_flags),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

export async function insertSolution(
  document: SolutionDocument,
  database: Database = getDatabase(),
): Promise<void> {
  await database.execute(
    `INSERT INTO amr.solutions (${SOLUTION_COLUMNS})
     VALUES (
       $1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9::jsonb, $10,
       $11::jsonb, COALESCE($12::timestamptz, now()), COALESCE($13::timestamptz, now())
     )`,
    [
      document._id,
      document.caseId,
      document.culpritSuspectId,
      JSON.stringify(document.canonicalTimeline),
      document.motive,
      document.method,
      document.explanation,
      JSON.stringify(document.supportingEvidenceIds),
      JSON.stringify(document.hintTexts),
      document.validationStatus,
      JSON.stringify(document.contentSafetyFlags),
      document.createdAt ?? null,
      document.updatedAt ?? null,
    ],
  );
}

export async function findSolutionByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<SolutionDocument | null> {
  const rows = await database.query<SolutionRow>(
    `SELECT ${SOLUTION_COLUMNS} FROM amr.solutions WHERE case_id = $1`,
    [caseId],
  );
  return rows[0] ? mapSolution(rows[0]) : null;
}

export async function updateSolutionValidationStatus(
  id: string,
  validationStatus: SolutionDocument["validationStatus"],
  database: Database = getDatabase(),
): Promise<number> {
  return database.execute(
    "UPDATE amr.solutions SET validation_status = $2, updated_at = now() WHERE id = $1",
    [id, validationStatus],
  );
}

export async function deleteSolutionsByCaseIds(
  caseIds: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }
  return database.execute("DELETE FROM amr.solutions WHERE case_id = ANY($1::text[])", [
    [...caseIds],
  ]);
}
