import type { EvidenceContent, EvidenceType, MediaStatus, Reliability } from "@amr/shared";
import type { EvidenceDocument } from "../models/Evidence.js";
import { getDatabase, type Database } from "../db/database.js";
import {
  asDate,
  asNullableDate,
  asNumber,
  asObject,
  asOptionalString,
  asStringArray,
} from "./rows.js";

interface EvidenceRow {
  id: string;
  case_id: string;
  exhibit_number: number;
  type: EvidenceType;
  title: string;
  public_description: string;
  content: unknown;
  occurred_at: unknown;
  source_label: string;
  reliability: Reliability;
  related_suspect_ids: unknown;
  related_timeline_event_ids: unknown;
  media_status: MediaStatus;
  media_url: string | null;
  alt_text: string | null;
  created_at: unknown;
  updated_at: unknown;
}

const EVIDENCE_COLUMNS = `
  id, case_id, exhibit_number, type, title, public_description, content,
  occurred_at, source_label, reliability, related_suspect_ids,
  related_timeline_event_ids, media_status, media_url, alt_text,
  created_at, updated_at
`;

function mapEvidence(row: EvidenceRow): EvidenceDocument {
  const mediaUrl = asOptionalString(row.media_url);
  const altText = asOptionalString(row.alt_text);
  return {
    _id: row.id,
    caseId: row.case_id,
    exhibitNumber: asNumber(row.exhibit_number),
    type: row.type,
    title: row.title,
    publicDescription: row.public_description,
    content: asObject<EvidenceContent>(row.content, { format: "generic", body: [] }),
    occurredAt: asNullableDate(row.occurred_at),
    sourceLabel: row.source_label,
    reliability: row.reliability,
    relatedSuspectIds: asStringArray(row.related_suspect_ids),
    relatedTimelineEventIds: asStringArray(row.related_timeline_event_ids),
    mediaStatus: row.media_status,
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(altText ? { altText } : {}),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

export async function insertEvidence(
  documents: readonly EvidenceDocument[],
  database: Database = getDatabase(),
): Promise<void> {
  for (const document of documents) {
    await database.execute(
      `INSERT INTO amr.evidence (${EVIDENCE_COLUMNS})
       VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb,
         $12::jsonb, $13, $14, $15, COALESCE($16::timestamptz, now()), COALESCE($17::timestamptz, now())
       )`,
      [
        document._id,
        document.caseId,
        document.exhibitNumber,
        document.type,
        document.title,
        document.publicDescription,
        JSON.stringify(document.content),
        document.occurredAt,
        document.sourceLabel,
        document.reliability,
        JSON.stringify(document.relatedSuspectIds),
        JSON.stringify(document.relatedTimelineEventIds),
        document.mediaStatus,
        document.mediaUrl ?? null,
        document.altText ?? null,
        document.createdAt ?? null,
        document.updatedAt ?? null,
      ],
    );
  }
}

export async function findEvidenceByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<EvidenceDocument[]> {
  const rows = await database.query<EvidenceRow>(
    `SELECT ${EVIDENCE_COLUMNS}
     FROM amr.evidence
     WHERE case_id = $1
     ORDER BY exhibit_number ASC`,
    [caseId],
  );
  return rows.map(mapEvidence);
}

export async function findEvidenceById(
  id: string,
  database: Database = getDatabase(),
): Promise<EvidenceDocument | null> {
  const rows = await database.query<EvidenceRow>(
    `SELECT ${EVIDENCE_COLUMNS} FROM amr.evidence WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapEvidence(rows[0]) : null;
}

export async function findEvidenceByIdAndCaseId(
  id: string,
  caseId: string,
  database: Database = getDatabase(),
): Promise<EvidenceDocument | null> {
  const rows = await database.query<EvidenceRow>(
    `SELECT ${EVIDENCE_COLUMNS}
     FROM amr.evidence
     WHERE id = $1 AND case_id = $2`,
    [id, caseId],
  );
  return rows[0] ? mapEvidence(rows[0]) : null;
}

export async function findEvidenceByIdsAndCaseId(
  ids: readonly string[],
  caseId: string,
  database: Database = getDatabase(),
): Promise<EvidenceDocument[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await database.query<EvidenceRow>(
    `SELECT ${EVIDENCE_COLUMNS}
     FROM amr.evidence
     WHERE id = ANY($1::text[]) AND case_id = $2
     ORDER BY exhibit_number ASC`,
    [[...ids], caseId],
  );
  return rows.map(mapEvidence);
}

export async function countEvidenceByCaseId(
  caseId: string,
  database: Database = getDatabase(),
): Promise<number> {
  const rows = await database.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM amr.evidence WHERE case_id = $1",
    [caseId],
  );
  return rows[0]?.count ?? 0;
}

export async function deleteEvidenceByCaseIds(
  caseIds: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (caseIds.length === 0) {
    return 0;
  }
  return database.execute("DELETE FROM amr.evidence WHERE case_id = ANY($1::text[])", [
    [...caseIds],
  ]);
}

export async function deleteEvidenceByIds(
  ids: readonly string[],
  database: Database = getDatabase(),
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  return database.execute("DELETE FROM amr.evidence WHERE id = ANY($1::text[])", [
    [...ids],
  ]);
}
