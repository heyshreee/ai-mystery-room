import type { ScoreBreakdown } from "@amr/shared";
import type { GameSessionDocument } from "../models/GameSession.js";
import { getDatabase, type Database } from "../db/database.js";
import {
  asDate,
  asNumber,
  asObject,
  asOptionalBoolean,
  asOptionalDate,
  asOptionalString,
  asStringArray,
} from "./rows.js";

interface GameSessionRow {
  id: string;
  case_id: string;
  guest_token_hash: string;
  status: GameSessionDocument["status"];
  viewed_evidence_ids: unknown;
  hints_used: number;
  accusation_suspect_id: string | null;
  is_correct: boolean | null;
  score: number | null;
  score_breakdown: unknown;
  started_at: unknown;
  completed_at: unknown;
  expires_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

const SESSION_COLUMNS = `
  id, case_id, guest_token_hash, status, viewed_evidence_ids, hints_used,
  accusation_suspect_id, is_correct, score, score_breakdown, started_at,
  completed_at, expires_at, created_at, updated_at
`;

function mapSession(row: GameSessionRow): GameSessionDocument {
  const accusationSuspectId = asOptionalString(row.accusation_suspect_id);
  const isCorrect = asOptionalBoolean(row.is_correct);
  const score = row.score === null ? undefined : asNumber(row.score);
  const scoreBreakdown =
    row.score_breakdown === null
      ? undefined
      : asObject<ScoreBreakdown | undefined>(row.score_breakdown, undefined);
  const completedAt = asOptionalDate(row.completed_at);
  return {
    _id: row.id,
    caseId: row.case_id,
    guestTokenHash: row.guest_token_hash,
    status: row.status,
    viewedEvidenceIds: asStringArray(row.viewed_evidence_ids),
    hintsUsed: asNumber(row.hints_used),
    ...(accusationSuspectId ? { accusationSuspectId } : {}),
    ...(isCorrect === undefined ? {} : { isCorrect }),
    ...(score === undefined ? {} : { score }),
    ...(scoreBreakdown === undefined ? {} : { scoreBreakdown }),
    startedAt: asDate(row.started_at),
    ...(completedAt ? { completedAt } : {}),
    expiresAt: asDate(row.expires_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

export async function insertGameSession(
  document: GameSessionDocument,
  database: Database = getDatabase(),
): Promise<void> {
  await database.execute(
    `INSERT INTO amr.game_sessions (${SESSION_COLUMNS})
     VALUES (
       $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11,
       $12, $13, COALESCE($14::timestamptz, now()), COALESCE($15::timestamptz, now())
     )`,
    [
      document._id,
      document.caseId,
      document.guestTokenHash,
      document.status,
      JSON.stringify(document.viewedEvidenceIds),
      document.hintsUsed,
      document.accusationSuspectId ?? null,
      document.isCorrect ?? null,
      document.score ?? null,
      document.scoreBreakdown ? JSON.stringify(document.scoreBreakdown) : null,
      document.startedAt,
      document.completedAt ?? null,
      document.expiresAt,
      document.createdAt ?? null,
      document.updatedAt ?? null,
    ],
  );
}

export async function findGameSessionById(
  id: string,
  database: Database = getDatabase(),
): Promise<GameSessionDocument | null> {
  const rows = await database.query<GameSessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM amr.game_sessions WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function findGameSessionByIdAndHash(
  id: string,
  guestTokenHash: string,
  database: Database = getDatabase(),
): Promise<GameSessionDocument | null> {
  const rows = await database.query<GameSessionRow>(
    `SELECT ${SESSION_COLUMNS}
     FROM amr.game_sessions
     WHERE id = $1 AND guest_token_hash = $2`,
    [id, guestTokenHash],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function addViewedEvidence(
  id: string,
  guestTokenHash: string,
  evidenceId: string,
  database: Database = getDatabase(),
): Promise<GameSessionDocument | null> {
  const rows = await database.query<GameSessionRow>(
    `UPDATE amr.game_sessions
     SET viewed_evidence_ids = CASE
           WHEN viewed_evidence_ids @> $3::jsonb THEN viewed_evidence_ids
           ELSE viewed_evidence_ids || $3::jsonb
         END,
         updated_at = now()
     WHERE id = $1
       AND guest_token_hash = $2
       AND status = 'investigating'
       AND expires_at > now()
     RETURNING ${SESSION_COLUMNS}`,
    [id, guestTokenHash, JSON.stringify([evidenceId])],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function incrementHintsUsed(
  id: string,
  guestTokenHash: string,
  hintLimit: number,
  database: Database = getDatabase(),
): Promise<GameSessionDocument | null> {
  const rows = await database.query<GameSessionRow>(
    `UPDATE amr.game_sessions
     SET hints_used = hints_used + 1, updated_at = now()
     WHERE id = $1
       AND guest_token_hash = $2
       AND status = 'investigating'
       AND expires_at > now()
       AND hints_used < $3
     RETURNING ${SESSION_COLUMNS}`,
    [id, guestTokenHash, hintLimit],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export interface CompleteSessionInput {
  id: string;
  guestTokenHash: string;
  expectedHintsUsed: number;
  accusationSuspectId: string;
  isCorrect: boolean;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  completedAt: Date;
}

export async function completeGameSession(
  input: CompleteSessionInput,
  database: Database = getDatabase(),
): Promise<GameSessionDocument | null> {
  const rows = await database.query<GameSessionRow>(
    `UPDATE amr.game_sessions
     SET status = 'completed',
         accusation_suspect_id = $3,
         is_correct = $4,
         score = $5,
         score_breakdown = $6::jsonb,
         completed_at = $7,
         updated_at = now()
     WHERE id = $1
       AND guest_token_hash = $2
       AND status = 'investigating'
       AND hints_used = $8
       AND expires_at > $7
     RETURNING ${SESSION_COLUMNS}`,
    [
      input.id,
      input.guestTokenHash,
      input.accusationSuspectId,
      input.isCorrect,
      input.score,
      JSON.stringify(input.scoreBreakdown),
      input.completedAt,
      input.expectedHintsUsed,
    ],
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function markGameSessionExpired(
  id: string,
  database: Database = getDatabase(),
): Promise<number> {
  return database.execute(
    `UPDATE amr.game_sessions
     SET status = 'expired', updated_at = now()
     WHERE id = $1 AND status <> 'expired'`,
    [id],
  );
}

export async function updateGameSessionExpiry(
  id: string,
  expiresAt: Date,
  database: Database = getDatabase(),
): Promise<number> {
  return database.execute(
    "UPDATE amr.game_sessions SET expires_at = $2, updated_at = now() WHERE id = $1",
    [id, expiresAt],
  );
}
