# 0001 — Deterministic sample and cookie-scoped sessions

- **Status:** Accepted; custom-generation behavior superseded by [`0002-async-provider-neutral-generation.md`](./0002-async-provider-neutral-generation.md). Persistence and test-runtime details revised by [`0003-postgres-supabase.md`](./0003-postgres-supabase.md).
- **Date:** 2026-10-25
- **Scope:** Phase 1 and Phase 2 implementation

## Context

The specification requires the complete core game loop to work without a live AI provider before runtime AI integration begins. The sample mystery must be validated, playable end to end, and safe to expose publicly. Sessions must protect progress and the final reveal, even though the app has no user accounts. Custom generation is a later phase, but the API and UI must not misrepresent it as available.

## Decisions

### 1. Use the normal case endpoint for the sample

`POST /api/cases` accepts `{ "sample": true }` instead of adding a separate sample endpoint. An optional `Idempotency-Key` scopes reuse to the requesting guest. A new case returns `201`; an idempotent replay returns `200`, both with a `Location` header.

**Why:** Keeps one creation contract, exercises the same case/session path, and avoids a parallel API surface. The shared schema rejects mixing sample and custom fields.

### 2. Sample files are public; sessions are private

The sample case is marked public and readable by any guest with its case ID. Progress, hints, accusations, and results remain bound to a session credential.

**Why:** The sample is the shared onboarding experience and contains no guest data. The solution is still isolated, and one-shot accusations prevent tampering. Custom cases remain owner-only and return `404` to other guests to avoid confirming their existence.

### 3. Custom briefs fail honestly while the provider is absent

A valid custom brief passes schema validation, then returns `503 AI_PROVIDER_UNAVAILABLE`. The frontend surfaces this state and preserves the guest's input.

**Why:** A fake or empty generated case would violate the product contract. The health endpoint reports `aiProvider: "mock"`, and the UI labels live generation as unavailable.

### 4. Guest and session cookies over accounts

- `amr_guest` holds a random token; only an HMAC hash is stored with cases for ownership and idempotency.
- `amr_session` holds `sessionId.token`; only a token hash is stored in the session document.

Both cookies are HttpOnly, `SameSite=Lax`, scoped to `/api`, and `Secure` in production. Session requests must match both the URL session ID and the token hash.

**Why:** Satisfies the no-account MVP while preventing ID-only access. Hashes mean a database read does not expose usable credentials. Cookie clearing intentionally loses access.

### 5. Explicit public serializers

Database rows are never returned directly. Presenters map each DTO field explicitly.

**Why:** During implementation, spreading a nested timeline object exposed internal fields that were not part of the public type. Explicit mapping makes the public/private boundary reviewable and prevents future schema additions from leaking.

### 6. One-shot accusation with an atomic write

The session transitions `investigating → completed` through a conditional `UPDATE ... WHERE` matching the guest hash, hint count, and unexpired status. A bounded retry handles a concurrent hint increment; a completed session returns `409`.

**Why:** Prevents double submissions or concurrent requests from overwriting the first score and reveal. Score is computed server-side from the stored hint count.

### 7. PGlite for integration tests

Backend integration tests use `@electric-sql/pglite` and its TCP socket server. Production and local development use a real PostgreSQL database through `pg`; tests and the E2E stack use an in-process PGlite instance.

**Why:** Reproducible tests without requiring an external database or network download, while exercising the same SQL and repository code paths.

### 8. Static fictional sample media

The sample's sightline diagram is a local SVG labeled as a simulated asset.

**Why:** No media provider exists in Phase 2, and the spec requires fictional/simulated media to be labeled clearly.

### 9. Do not rewrite product requirements

The product requirements in `SPEC.md` are unchanged. The sample request shape, cookie behavior, and storage engine are implementation details documented in the README and this record, not new product requirements.

## Consequences

- Rate limits are in-memory and single-process; horizontal scaling requires a shared store.
- Guests who clear cookies lose private cases and sessions; there is no recovery flow.
- The sample stays public but cannot be modified through the API.
- Live AI/media work remains optional and unverified; the deterministic sample and mock generator keep the app playable.
- The frontend uses `frontend/scripts/run-tsc.mjs` to invoke TypeScript directly because npm's generated bin shims rewrite paths to Windows paths under WSL2 and break workspace symlink resolution. This is a local tooling workaround, not a product contract.

## Follow-ups

1. Implement the Phase 3 provider interface, live generation, retries/timeouts, and structured-output validation.
2. Add provider contract tests, including prompt-injection and malformed-output cases.
3. Add Playwright E2E for the full sample journey and error states.
4. Move rate limiting to a shared store before multi-instance deployment.
5. Add automated accessibility checks and media-provider integration when those features land.
