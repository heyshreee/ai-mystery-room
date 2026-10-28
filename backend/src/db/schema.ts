import type { Database } from "./database.js";

/**
 * The application owns the isolated `amr` schema so it can share a Supabase
 * project with unrelated tables. Every statement is idempotent; the API runs
 * this at startup so a fresh database becomes usable without a separate
 * migration step.
 */
export const SCHEMA_STATEMENTS: readonly string[] = [
  "CREATE SCHEMA IF NOT EXISTS amr",

  `CREATE TABLE IF NOT EXISTS amr.cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    scenario TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('theft', 'missing_person', 'fraud', 'sabotage', 'other')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    status TEXT NOT NULL CHECK (status IN ('generating', 'validating', 'ready', 'failed')),
    creator_session_id TEXT NOT NULL,
    suspect_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    generation_version TEXT NOT NULL,
    generation_id TEXT NOT NULL,
    idempotency_key TEXT,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    incident JSONB NOT NULL,
    timezone TEXT NOT NULL,
    case_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    fiction_notice TEXT NOT NULL,
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS cases_status_created_idx
    ON amr.cases (status, created_at DESC)`,

  `CREATE UNIQUE INDEX IF NOT EXISTS cases_generation_idx
    ON amr.cases (generation_id)`,

  `CREATE UNIQUE INDEX IF NOT EXISTS cases_creator_idempotency_idx
    ON amr.cases (creator_session_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL`,

  `CREATE TABLE IF NOT EXISTS amr.suspects (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES amr.cases(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    profile TEXT NOT NULL,
    motive_summary TEXT NOT NULL,
    opportunity_summary TEXT NOT NULL,
    public_statement TEXT NOT NULL,
    relationships JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  "CREATE INDEX IF NOT EXISTS suspects_case_idx ON amr.suspects (case_id)",

  `CREATE TABLE IF NOT EXISTS amr.evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES amr.cases(id) ON DELETE CASCADE,
    exhibit_number INTEGER NOT NULL CHECK (exhibit_number >= 1),
    type TEXT NOT NULL CHECK (type IN (
      'chat_transcript', 'image', 'cctv_log', 'cctv_transcript', 'witness_statement',
      'suspect_statement', 'access_log', 'document', 'timeline_event'
    )),
    title TEXT NOT NULL,
    public_description TEXT NOT NULL,
    content JSONB NOT NULL,
    occurred_at TIMESTAMPTZ,
    source_label TEXT NOT NULL,
    reliability TEXT NOT NULL CHECK (reliability IN ('low', 'medium', 'high', 'unknown')),
    related_suspect_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_timeline_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    media_status TEXT NOT NULL CHECK (media_status IN ('not_required', 'pending', 'ready', 'failed')),
    media_url TEXT,
    alt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (case_id, exhibit_number)
  )`,

  "CREATE INDEX IF NOT EXISTS evidence_case_type_idx ON amr.evidence (case_id, type)",
  "CREATE INDEX IF NOT EXISTS evidence_case_occurred_idx ON amr.evidence (case_id, occurred_at)",

  `CREATE TABLE IF NOT EXISTS amr.solutions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL UNIQUE REFERENCES amr.cases(id) ON DELETE CASCADE,
    culprit_suspect_id TEXT NOT NULL,
    canonical_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    motive TEXT NOT NULL,
    method TEXT NOT NULL,
    explanation TEXT NOT NULL,
    supporting_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    hint_texts JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    content_safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS amr.game_sessions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES amr.cases(id) ON DELETE CASCADE,
    guest_token_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('investigating', 'completed', 'expired')),
    viewed_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    accusation_suspect_id TEXT,
    is_correct BOOLEAN,
    score INTEGER CHECK (score IS NULL OR score >= 0),
    score_breakdown JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS game_sessions_case_expiry_idx
    ON amr.game_sessions (case_id, expires_at)`,

  `CREATE INDEX IF NOT EXISTS game_sessions_guest_idx
    ON amr.game_sessions (guest_token_hash)`,

  `CREATE TABLE IF NOT EXISTS amr.generation_jobs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL UNIQUE REFERENCES amr.cases(id) ON DELETE CASCADE,
    creator_session_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'validating', 'ready', 'failed')),
    stage TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    provider TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    error_code TEXT,
    message TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS generation_jobs_status_created_idx
    ON amr.generation_jobs (status, created_at DESC)`,
];

export async function initializeSchema(database: Database): Promise<void> {
  const [schema] = await database.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.schemata WHERE schema_name = 'amr'
     ) AS exists`,
  );

  // A least-privilege application role only needs USAGE and CREATE on its own
  // schema. Checking first avoids requiring CREATE on the database, which the
  // Supabase pooler role intentionally does not grant.
  const statements = schema?.exists ? SCHEMA_STATEMENTS.slice(1) : SCHEMA_STATEMENTS;
  for (const statement of statements) {
    await database.execute(statement);
  }
}
