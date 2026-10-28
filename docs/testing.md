# Testing

## Commands

Run everything from the repository root after `npm install`. Unit and integration suites need no running PostgreSQL instance or real `.env`; the backend suite starts an in-process PGlite database and exposes it through the PGlite TCP socket server. The same code path is used in production with `pg` against PostgreSQL.

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

Targeted suites:

```bash
npm run test:backend
npm run test:frontend
npm run test:e2e
```

`npm run test:e2e` builds all three packages, then starts a self-contained Playwright stack:

- an in-process PGlite database over the PGlite TCP socket server, with `DATABASE_SSL=disable` and `maxConnections: 10`;
- the built Express API on `127.0.0.1:4000`;
- the built frontend through `vite preview` on `127.0.0.1:4173`, with `/api` proxied to the API.

The stack is started by `e2e/stack.mjs` and configured in `playwright.config.ts`. It does not touch a developer database and does not require `.env` or network access. PGlite's socket server defaults to one connection, so the stack explicitly raises the limit.

PostgreSQL behavior is not identical to PGlite. The production path is exercised separately against the Supabase pooler before deployment; see [Latest observed results](#latest-observed-results).

If the Playwright browser is missing:

```bash
npx playwright install chromium
```

## Test inventory

### Backend — 8 files, 75 tests

| File | Tests | Coverage |
| --- | ---: | --- |
| `backend/tests/api.integration.test.ts` | 26 | Health/readiness, request IDs, origin allowlist, malformed JSON, body-size limit, sample creation/idempotency, public DTO isolation, ownership, validation errors, asynchronous custom generation, validated publication, in-flight duplicate sharing, invalid-output cleanup, publication gate, timeout/unavailable retries, retry-then-success, restart recovery, generation rate limiting, correct/incorrect accusations, scoring, cross-case rejection, session expiry |
| `backend/src/tests/schemas.test.ts` | 10 | Custom/sample request schemas, scenario bounds, category/preference validation, duplicate preferences, unknown-field rejection, sample/custom exclusivity, client-supplied score rejection, idempotency keys |
| `backend/src/tests/case-validation.test.ts` | 8 | Valid sample fixture; unknown culprit; insufficient supporting evidence; unknown timeline reference; out-of-order public timeline; culprit leakage in evidence metadata and hints; canonical event missing from public timeline |
| `backend/src/tests/scoring.test.ts` | 5 | Base score, hint penalty, zero floor, incorrect accusation, invalid hint counts |
| `backend/src/tests/rate-limit.test.ts` | 1 | Allow-up-to-limit then `429` behavior |
| `backend/src/tests/openai-compatible-provider.test.ts` | 11 | OpenAI-compatible request shape, endpoint normalization, fenced JSON parsing, bounded retry/backoff, credential failure, timeout normalization, malformed/empty output, safe error messages |
| `backend/src/tests/config.test.ts` | 9 | Mock/static defaults, provider-neutral configuration, required URL/model, URL scheme validation, unsupported modes, bounded limits, secret-safe errors, placeholder rejection, Postgres URL/SSL validation |
| `backend/src/tests/generation.test.ts` | 5 | Category/difficulty matrix, evidence-preference coverage, mapping invariants, determinism, public-metadata/hint isolation, provider-neutral prompt construction |

The integration suite exercises the real Express app, middleware, services, Postgres repositories, PGlite schema, and the in-process generation worker. It verifies security boundaries such as:

- Public case payloads contain no culprit, solution, canonical timeline, or hint text.
- Another guest cannot read another guest's case, generation status, or session.
- Evidence and suspect IDs from a different case are rejected.
- A second accusation cannot change the result.
- Expired sessions return `410`.
- The sample remains readable by guests and playable when a provider is failing.
- An invalid or leaking generated blueprint publishes nothing and leaves no partial suspects, evidence, or solution.
- A restart-interrupted job is marked `failed` and cleaned.

### Frontend — 5 files, 24 tests

| File | Tests | Coverage |
| --- | ---: | --- |
| `frontend/src/lib/api.test.ts` | 7 | Success envelope unwrapping, credentials, sample request shape/idempotency key, error envelope mapping, network errors, abort passthrough, malformed/non-JSON responses |
| `frontend/src/lib/generation.test.ts` | 5 | Stage-to-step progression, unknown stages, provider/stage labels, in-flight predicate, status type guard |
| `frontend/src/pages/CreateCasePage.test.tsx` | 7 | Empty-submission validation, honest staged progress and form lock, polling to ready, failure with fresh-key retry, interrupted-poll recovery, ambiguous-failure key reuse, server field errors |
| `frontend/src/pages/LandingPage.test.tsx` | 2 | Sample creation and navigation, recoverable error with retry |
| `frontend/src/features/evidence/EvidenceContentView.test.tsx` | 3 | Approved diagram, image-error fallback, missing-URL fallback |

Tests use Vitest, jsdom, Testing Library, and `user-event`. The Vite config disables CSS processing in tests and restores mocks between tests.

### Browser E2E — 2 files, 6 tests

| File | Tests | Coverage |
| --- | ---: | --- |
| `e2e/game.spec.ts` | 4 | Full sample journey with hint and correct reveal; incorrect accusation with zero score and reveal; real mock-provider custom generation; mocked generation failure/progress/fresh-key retry |
| `e2e/accessibility.spec.ts` | 2 | Axe WCAG A/AA scans and horizontal-overflow checks for landing, creation, investigation, accusation dialog, and results at desktop and mobile widths |

The axe checks use `@axe-core/playwright` with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` tags. They assert **zero** violations on every covered screen at both desktop and mobile widths, along with no horizontal page overflow at mobile. The failure-state E2E test intercepts only the generation API responses so the UI failure path can be exercised deterministically; the success path uses the real API and mock generator.

## Latest observed results

Verified on **2026-10-28** (Node 24, npm 11, WSL2):

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed — 0 errors, 0 warnings |
| `npm run build` | Passed — shared/backend emitted; frontend bundle built |
| Backend suite | **75/75 passed**, 8/8 files |
| Frontend suite | **24/24 passed**, 5/5 files |
| Playwright E2E | **6/6 passed**, 2/2 files; axe reports zero WCAG A/AA violations on covered screens |
| Dependency audit | `npm audit` reports **0 vulnerabilities** (production and full dependency trees) |
| Production build smoke | Covered by the E2E stack: built API + built frontend + fresh PGlite database |
| Supabase preflight | **Passed** against the production database through the pooler: schema initialization, sample play, hints, accusation/results, 404s, custom mock generation to `ready`, and cleanup |

The production frontend build emits Rollup notices about `@__PURE__` comments inside Zod's published files. They are third-party annotation warnings, not build failures.

## Manual smoke test

The automated E2E suite covers the main journeys. Before shipping, still verify in the target browsers:

1. Start PostgreSQL, set `DATABASE_URL`/`DATABASE_SSL`, and run `npm run dev`; open `http://localhost:5173`.
2. Launch the sample from the landing page. Confirm suspects, eight exhibits, timeline, and hint counter load.
3. Open several exhibits and confirm progress persists after refresh (session cookie).
4. Use all three hints; confirm the fourth is refused and the button disables.
5. Open the accusation dialog, verify keyboard focus and Escape behavior, then accuse the culprit and check the result page.
6. Reload the results URL and confirm it remains available; attempt a second accusation and confirm it is locked.
7. Submit a valid custom brief and confirm progress stages appear, then the investigation room opens. Confirm no percentage is shown.
8. Exercise a failed generation (for example with a deliberately invalid provider configuration) and confirm retry uses a new request key and no partial case is playable.
9. Clear cookies and confirm a private case/session is no longer accessible.
10. Check desktop and mobile widths, including the evidence table and image fallback.

## Gaps and deferred coverage

- **No verified live-provider test** — the `openai-compatible` adapter is tested against a mocked HTTP server only. A real endpoint/model/credential must be selected and exercised separately.
- **No live media tests** — static SVG and text fallback are the only implemented media paths.
- **PGlite is not PostgreSQL** — it exercises the application's SQL and repository code, but not the Supabase pooler, TLS termination, concurrency, or version-specific planner behavior. The production path has a separate smoke preflight against Supabase.
- **No durable queue or multi-instance tests** — startup recovery assumes one API process owns the database.
- **No load/performance tests** — rate limiting is in-memory and single-process.
- **No visual-regression tests** — styling is checked by build, axe, and browser E2E.
- **No backup/restore drill or provider-quota validation** — the deployed app is checked over HTTP, but restore and quota behavior have not been exercised.
