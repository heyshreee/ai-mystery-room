# Architecture

This document describes the implemented architecture through Phase 5. `SPEC.md` remains the product source of truth.

## Overview

AI Mystery Room is an npm-workspace monorepo with three packages:

| Package | Responsibility |
| --- | --- |
| `shared` | Constants, Zod request schemas, and API view types shared by both runtimes |
| `backend` | Express 5 API, PostgreSQL persistence via `pg`, sample and generated case pipelines, scoring, authorization |
| `frontend` | React 19 + Vite SPA for the landing page, case brief, generation progress, investigation room, and results |

The backend is the only trusted boundary. It validates input, owns the solution, computes scores, and decides which fields leave the server. The frontend never receives the culprit or canonical solution before an authorized reveal.

```text
Browser
  │  same-origin /api in development (Vite) and preview builds
  ▼
Express app
  │  request ID → Helmet → CORS → origin guard → JSON limit → cookies → guest identity
  │  global rate limit → route validation → service → repositories
  ▼
PostgreSQL (isolated `amr` schema)
  cases · suspects · evidence · solutions · game_sessions · generation_jobs
```

## Request lifecycle and foundation

`backend/src/app.ts` composes middleware in this order:

1. **Request context** — assigns/propagates a request ID and structured logger.
2. **Helmet** — security headers; HSTS only in production.
3. **CORS** — credentials enabled, only configured frontend origins allowed.
4. **Origin guard** — rejects state-changing requests from unapproved `Origin` values, covering non-browser and proxy paths as well.
5. **JSON body parser** — `strict: true`, configurable size limit (32 KB by default); JSON output escaping is enabled.
6. **Cookies and guest identity** — parses cookies and issues a guest cookie when absent.
7. **Rate limits** — a global API limit, plus narrower case-generation and hint limits.
8. **Routes** — `/api/health`, `/api/cases`, `/api/evidence`, `/api/sessions`, `/api/generation`.
9. **Not-found and error handlers** — consistent `{ error: { code, message, details?, requestId } }` envelopes without stack traces.

`GET /api/health` is mounted before the rate limiter and reports service version, database connectivity, configured AI provider, media mode, and a timestamp. It never reports credentials or prompts.

Configuration is loaded once at startup through a Zod schema (`backend/src/config/env.ts`). Missing or malformed values fail fast. The root `.env` is loaded server-side only; `VITE_API_BASE_URL` is the only client-visible configuration.

At startup, the API creates a small `pg` pool, pings PostgreSQL, and applies the idempotent `amr` schema. It checks for the schema first, so the application role only needs `USAGE` and `CREATE` on `amr`, not permission to create schemas or databases. After the schema is ready and before the HTTP listener starts, `recoverInterruptedGenerations` marks unfinished in-process jobs and cases as failed and deletes partial suspects, evidence, or solutions. This makes a restart distinguishable from an indefinite “pending” state.

Production connects through the Supabase transaction pooler on port `6543` with a per-instance pool capped at three connections. `DATABASE_SSL=no-verify` encrypts traffic but does not authenticate the pooler's self-signed certificate chain. Tests and E2E use PGlite over its TCP socket server, which exercises the same repository SQL without an external database.

## Runtime AI generation

### Provider-neutral boundary

`backend/src/generation/types.ts` defines the provider contract:

```ts
interface AIProvider {
  readonly id: string;
  generateStructured(input: {
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    schema: unknown;
    temperature?: number;
    timeoutMs: number;
    context?: GenerationRequest;
  }): Promise<unknown>;
}
```

`context` exists only for deterministic local adapters such as the mock generator. External providers receive the prompts and schema.

Two adapters are implemented:

- **`mock` (default)** — deterministic, network-free generation in `mock-blueprint.ts`. It honors the submitted category, difficulty, scenario, and evidence preferences while covering all supported categories.
- **`openai-compatible`** — an optional HTTP adapter configured with `AI_BASE_URL`, `AI_MODEL`, and an optional `AI_API_KEY`. It sends an OpenAI-compatible `/chat/completions` request with a JSON-schema prompt, parses JSON (including fenced JSON), applies a request timeout, retries transient failures with bounded backoff, and maps failures to safe categories.

No provider endpoint, model, or key is assumed. The adapter is covered by mocked-HTTP unit tests; it has not been verified against a live third-party endpoint in this repository.

### Validation layers

Generated output becomes playable only after all of these pass:

1. **Schema validation** — `caseBlueprintSchema` in `backend/src/generation/blueprint.ts` strictly validates the blueprint shape, categories, difficulty, references, and evidence formats.
2. **Brief alignment** — category, difficulty, incident timeline window, and significant scenario terms must agree with the submitted brief.
3. **Deterministic structural validation** — `validateCaseStructure` checks the mapped documents: suspect/evidence/timeline references, ordering, unique exhibit numbers, culprit membership, supporting evidence, and solution/hint leakage.
4. **Persistence gate** — the case is marked `ready` only after suspects, evidence, and solution are saved in one transaction. A failed persistence attempt rolls back and marks the case failed.

The solution row is never serialized into public case or evidence DTOs. It is returned only by an authorized result endpoint after a completed accusation.

### Asynchronous job flow

`POST /api/cases` with a custom brief:

1. Validates the shared request schema.
2. Creates a private `generating` case and a `pending` generation job (or reuses an existing idempotent request).
3. Starts an in-process generation task and returns `202 Accepted` with a `GenerationStatusView` and `Location: /api/generation/:id`.
4. The client polls `GET /api/generation/:id`. The job reports named stages: `queued`, `normalizing_brief`, `drafting_blueprint`, `repairing_blueprint`, `validating_case`, `publishing`, `published`, or `failed`.
5. When the job is `ready`, the client opens `/case/:caseId`. A replayed request whose case is already ready returns `200` with `CaseCreatedView`.

The client never receives a percentage because the backend does not measure one. Progress is stage-based and honest.

Provider and validation failures are retried up to `MAX_GENERATION_ATTEMPTS`. Non-retryable credential failures stop immediately. Failures expose only `AI_PROVIDER_UNAVAILABLE`, `GENERATION_TIMEOUT`, `INVALID_AI_OUTPUT`, or `GENERATION_FAILED` plus a safe message. Raw provider responses, prompts, and secrets are not stored on the job or returned to the client.

The frontend:

- locks the form while a generation is in flight or failed;
- polls at a fixed interval and recovers from an interrupted poll without resubmitting;
- offers a retry with a **new** idempotency key after a definitive failure;
- reuses the key after an ambiguous network failure where the server may already have accepted the request;
- offers the sample as a fallback at every failure point.

Idempotency is scoped to the guest hash and request key. Concurrent duplicate submissions share the same case and generation job.

### Durability boundary

Jobs run inside the API process. They are **not** durable:

- A restart interrupts active work. Startup recovery marks it failed and cleans partial rows, so a client can retry rather than polling forever.
- Multiple API replicas cannot safely share this model. A durable queue and worker ownership are required before horizontal scaling.

## Media

There is no live image or video adapter. `MEDIA_PROVIDER` accepts:

- `static` (default) — image exhibits reference `/case-assets/evidence-map.svg`, an approved fictional service-route diagram with a text description and interpretation.
- `none` — image exhibits keep their written description and interpretation without an image URL.

The evidence renderer falls back to the written exhibit if the image is missing or fails to load. Every generated case and sample case carries a fiction notice; simulated assets are labeled in the UI.

## Data model

All tables live in the `amr` schema. Primary keys are `TEXT` values containing 24 lowercase hex characters, preserving the public API and cookie format used before the Postgres port. Nested structures are stored as `JSONB`; relationships that need integrity use foreign keys with `ON DELETE CASCADE`.

| Table | Purpose | Key relationships |
| --- | --- | --- |
| `cases` | Public case metadata, incident, rules, public timeline, ordering, status | References suspect/evidence IDs in `JSONB`; stores creator and idempotency key; links one generation |
| `suspects` | Public profiles, motives/opportunity summaries, statements, relationships | Belongs to one case via `case_id` |
| `evidence` | Exhibit metadata and structured content (`chat`, `log`, `statement`, `document`, `image`, `transcript`, `generic`) | Belongs to one case; references timeline events and suspects |
| `solutions` | Culprit, canonical timeline, motive/method/explanation, supporting evidence, hint texts | One per case (`case_id UNIQUE`); never serialized into public DTOs |
| `game_sessions` | Guest-scoped progress: viewed evidence, hints used, accusation, score, status, expiry | References one case; stores only a token **hash** |
| `generation_jobs` | Status, stage, attempts, provider, prompt version, safe error code/message | One per case; never stores provider secrets or raw prompts |

Indexes cover case status/creation order, generation lookup, per-guest idempotency, suspects by case, evidence by case/type/occurrence, sessions by case/expiry and guest hash, and generation status. Unique constraints enforce one solution per case, one job per case, unique exhibit numbers per case, and one generation per case.

## Public/private boundary

Both sample and generated cases pass deterministic validation before publication. Validation checks, among other things:

- 3–6 suspects, unique names/IDs, valid relationships, and non-empty profiles.
- A culprit who belongs to the case.
- A public timeline that is ordered, complete, and does not name the culprit.
- Canonical events that exist in the public timeline and do not place a suspect in two locations at once.
- Evidence references, at least two supporting evidence items, and hints that do not name the culprit.

Serialization is explicit in `backend/src/services/presenters.ts`; it does not spread database rows. In particular:

- The public case DTO contains incident, rules, timeline, suspects, evidence count, and fiction notice — never `solution`, culprit ID, canonical timeline, or hints.
- Evidence list responses contain metadata; detail responses add structured content.
- Results are only returned by `POST /api/sessions/:id/accusations` and `GET /api/sessions/:id/results`, after session authentication and completion.

This explicit mapping prevents database columns added in the future from leaking by default.

## Identity and authorization

Two HttpOnly, `SameSite=Lax` cookies are used; both are `Secure` in production and scoped to `/api`:

- `amr_guest` — a random 256-bit guest token. The server stores only `HMAC-SHA256(SESSION_SECRET, token)` when it needs to associate cases with a guest.
- `amr_session` — `sessionId.token`. The database stores only a hash of the token.

Authorization rules:

- A session request must include a cookie whose session ID matches the URL **and** whose token hash matches the stored hash. Otherwise the API returns `404 SESSION_NOT_FOUND` without confirming existence.
- Expired sessions are marked expired and return `410 SESSION_EXPIRED`.
- Sample cases are public: any guest with the case ID can read the file. Custom cases and generation status are readable only by the creating guest.
- Evidence and suspect IDs are always checked against the session's case, preventing cross-case references.
- Accusations are one-shot. A conditional `UPDATE ... WHERE` transitions the session from `investigating` to `completed` while matching the guest hash, current hint count, and unexpired status. Concurrent accusations cannot overwrite the first result.
- Results remain unavailable until the session is completed.

## Game engine

The sample fixture (`backend/src/services/sample-case.ts`) is instantiated with fresh 24-character hex IDs, validated, and persisted. `POST /api/cases` with `{ "sample": true }`:

1. Optionally looks up an existing case by `(creator guest hash, Idempotency-Key)`.
2. Instantiates a new sample case with a completed mock generation job.
3. Runs deterministic validation and rejects publication on any issue.
4. Persists suspects, evidence, solution, job, and case; cleans up on failure.
5. Returns `201` for a new case or `200` for an idempotent replay, with a `Location` header.

Generated cases use the same validation and persistence boundary after provider output and mapping.

Gameplay rules live server-side:

- Viewed evidence is appended to a `JSONB` array only when absent, in one conditional update, and must belong to the session's case.
- Hints increment atomically up to the configured limit (default 3); hint text comes from the solution and is never included in the case payload.
- Score = `100` for a correct accusation, minus `10` per hint, clamped at `0`; incorrect accusations score `0`.
- The result includes the selected suspect, culprit profile, motive/method/explanation, supporting evidence summaries, score breakdown, and completion time.

## Frontend

Routes (`frontend/src/App.tsx`):

| Route | Screen |
| --- | --- |
| `/` | Landing page; sample launch and custom-brief entry |
| `/create` | Case brief form, generation progress, failure/retry states |
| `/sample` | Sample launcher with retry/error handling |
| `/case/:caseId` | Investigation room |
| `/case/:caseId/results/:sessionId` | Authorized result and reveal |
| `*` | Not found |

The investigation page loads the public case, evidence, and session together, then renders suspect profiles, the evidence browser, timeline, and hints. Evidence rendering chooses a view per content format, with image fallback text. Timezone-aware formatting uses the case timezone. The accusation dialog requires explicit confirmation and reflects the one-shot rule.

The API client (`frontend/src/lib/api.ts`) always sends credentials, unwraps the `data` envelope, and maps error envelopes into `ApiError` with code, details, and request ID. The UI is styled with Tailwind design tokens and includes fiction notices, keyboard-accessible controls, focus states, skip navigation, and responsive layouts.

## Verification

- Backend unit/integration tests run the real Express app and repositories against PGlite over a TCP socket. They cover the generation pipeline, validation, retries, failures, idempotency, ownership, restart recovery, and runtime provider behavior with a mocked HTTP server.
- The production database path was smoke-tested against the Supabase transaction pooler: schema initialization, sample play, hints, accusation/results, 404s, custom mock generation to `ready`, and cleanup.
- Frontend tests cover the generation polling flow, failure/retry behavior, duplicate-submission locking, image fallback, and API error mapping.
- Playwright E2E covers the full sample journey, correct and incorrect accusations with reveal, custom generation, generation failure/retry UI, mobile layout, and solution isolation.
- Axe checks run against the landing, creation, investigation, accusation dialog, and results screens at desktop and mobile widths.

## Trade-offs and known constraints

- **In-process jobs**: generation is not durable across multiple API replicas or between restarts. Startup recovery makes interruption explicit, but a durable queue is still required for scale-out.
- **No verified live model**: the `openai-compatible` adapter exists but requires a chosen endpoint/model/credentials; only mocked HTTP behavior is verified.
- **No live media**: image exhibits use a static fictional SVG or written text. TTS and video are not implemented.
- **Single-process rate limiting**: limits are in-memory and reset on restart. A multi-instance deployment needs a shared store (e.g. Redis).
- **Guest identity, not accounts**: progress is tied to cookies. Clearing cookies loses access to private sessions and cases.
- **Startup DDL, not migrations**: schema creation is idempotent, but a destructive or data-transforming change needs a versioned migration process.
- **Pooler certificate not verified**: Supabase's pooler currently presents a self-signed chain, so production uses `no-verify`. Traffic is encrypted, but the server is not authenticated by certificate.
- **No load/performance or visual-regression tests** yet.
