# 0003 — PostgreSQL on Supabase, isolated `amr` schema

- **Status:** Accepted
- **Date:** 2026-10-28
- **Scope:** Production persistence and the test database runtime

## Context

The Vercel deployment had a frontend and API entry point but no reachable production database. The original MongoDB connection string was a local placeholder, so `/api/health` correctly returned `503` and the game could not be played. The Supabase project already hosts unrelated tables in `public`, so the application must not assume it owns the database.

## Decisions

### 1. Use PostgreSQL through the Supabase pooler

Production uses `pg` against Supabase's transaction pooler on port `6543`. The API reads a single `DATABASE_URL` and an explicit `DATABASE_SSL` mode. The pool is capped at three connections per serverless instance.

**Why:** Supabase provides managed PostgreSQL with IPv4 pooler endpoints, backups, and a free tier. A small per-instance pool leaves headroom for Fluid Compute instances that share the pooler.

### 2. Keep application data in a dedicated `amr` schema

All tables live in `amr`, not `public`. The application connects as a dedicated `amr_app` role with `LOGIN`, `USAGE`, and `CREATE` on that schema only. It is not a superuser and cannot create databases or roles. The `amr` schema is created once by an administrator; the API's idempotent DDL then creates and indexes the tables on startup.

**Why:** The Supabase project is shared with unrelated objects. Schema isolation prevents accidental reads, writes, or name collisions, and the least-privilege role limits blast radius if the connection string leaks.

### 3. Initialize the schema at API startup

`initializeSchema` checks `information_schema.schemata` for `amr` and skips `CREATE SCHEMA` when it already exists. The remaining `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements run on every start.

**Why:** A fresh database becomes usable without a separate migration step. Checking for the schema first means the application role does not need `CREATE` on the database.

### 4. Preserve 24-character hex public IDs

Primary keys are `TEXT` containing 24 lowercase hex characters generated with `randomBytes(12)`. The existing public API, cookie format, validation, and tests did not need to change shape.

**Why:** Avoids a breaking API change and keeps URLs and session cookies stable during the storage port.

### 5. Use PGlite for tests and E2E

Vitest integration tests and the Playwright stack start an in-process PGlite instance and expose it over the PGlite TCP socket server. Tests set `DATABASE_SSL=disable`. Production uses real PostgreSQL through `pg`.

**Why:** The test suite stays self-contained and network-free while exercising the same SQL, repositories, and Express application. PGlite is not a perfect PostgreSQL substitute, so the production path is also smoke-tested against the Supabase pooler.

## Consequences

- Supabase's pooler presents a self-signed certificate chain. Production therefore uses `DATABASE_SSL=no-verify`, which still encrypts the connection but does not authenticate the server. A pinned CA can replace this when the provider exposes a stable public chain.
- The startup DDL is intentionally idempotent, not a migration history. A future destructive or data-transforming change needs a versioned migration process.
- Transaction-pooler connections cannot rely on session state. The application uses only statements and transactions that are safe in transaction mode.
- In-process generation jobs remain non-durable. Moving to a durable queue is still required before horizontal worker scaling.
- PGlite covers the SQL surface used by the application, but it is not a replacement for testing against the target PostgreSQL version under load.
