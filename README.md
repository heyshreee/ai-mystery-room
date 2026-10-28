# AI Mystery Room

AI Mystery Room is a fictional detective game. A guest submits a scenario or opens the hand-authored sample, studies suspects and exhibits, spends hints, and makes one final accusation. The complete game loop runs without a live AI provider: the default generator is deterministic and network-free.

`SPEC.md` remains the product source of truth. Phases 1–5 are implemented, including asynchronous custom generation, a provider-neutral runtime adapter, static fictional media, browser E2E, and accessibility checks. A live model endpoint has **not** been verified because no provider credentials are part of this repository.

## Live deployment

- **App:** <https://ai-mystery-room-git.vercel.app>
- **CI:** [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs lint, typecheck, build, backend/frontend tests, and Playwright on every push and pull request.
- **CD:** Vercel Git integration deploys `main` to production automatically.

Production storage is Supabase PostgreSQL. The API connects through the Supabase transaction pooler and keeps its tables in an isolated `amr` schema, which it creates and indexes on startup. The live deployment is re-verified after each push; see [Verified status](#verified-status) for the latest observed results.

## Current scope

**Available now**

- Playable sample mystery: **The Meridian at Midnight** — 4 suspects, 8 exhibits, 11 public timeline events, 3 hints, server-scored accusation and reveal.
- Asynchronous custom-case generation from a scenario, category, difficulty, and evidence preferences.
- Deterministic `mock` provider by default; no key, network, or external service required.
- Optional provider-neutral `openai-compatible` HTTP adapter configured through environment variables.
- Strict blueprint validation, brief-alignment checks, deterministic structural validation, bounded retries/timeouts, and a publication gate.
- Honest stage-based progress with no fake percentages, poll-interruption recovery, failure/retry states, form locking, and idempotent duplicate protection.
- Startup recovery for generation interrupted by an API restart.
- Static fictional evidence diagram with a written fallback if the image is unavailable; generated media is never presented as real.
- Guest/session cookies with hashed credentials, ownership checks, one-shot accusations, and server-side scoring.
- Request IDs, structured logging, security headers, origin allowlist, rate limits, body-size limits, and consistent error envelopes.
- Vitest unit/integration suites, committed Playwright E2E, and axe WCAG A/AA checks on desktop and mobile.

**Not available**

- A verified live model integration. The adapter exists and is tested against a mocked HTTP provider, but no real endpoint/model has been exercised.
- Live image, video, or TTS generation. Image exhibits use an approved static SVG or written text only.
- A durable generation queue. Jobs run in-process and are not safe for multiple API replicas; see [Durability and scaling](#durability-and-scaling).
- Accounts, a public case marketplace, or real-time generated CCTV.

## Requirements

- Node.js **>= 22.12** (verified on Node 24 / npm 11)
- npm workspaces (npm 10+ recommended)
- PostgreSQL 14+ for local development and production-style runs (Supabase runs PostgreSQL 17)
- Chromium for Playwright (`npx playwright install chromium` if not already cached)

The backend test suite and the E2E stack start an in-process PGlite database, so they need no running PostgreSQL instance and no network access.

## Setup

```bash
npm install
cp .env.example .env
```

Generate a real session secret and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Start PostgreSQL. For example:

```bash
docker run --rm -p 5432:5432 --name amr-postgres \
  -e POSTGRES_PASSWORD=postgres postgres:17
```

Point `DATABASE_URL` at it and choose an SSL mode:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
DATABASE_SSL=disable
```

The API applies its idempotent DDL at startup and creates the `amr` schema and its six tables if they do not exist. A non-superuser application role needs `USAGE` and `CREATE` on `amr`; it does not need permission to create schemas or databases.

Then:

```bash
npm run dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>

Vite proxies `/api`, so browser requests are same-origin in development. `vite preview` uses the same proxy configuration for the E2E stack.

### Database and SSL modes

`DATABASE_URL` is the only connection setting. `DATABASE_SSL` selects transport security:

| Value | Behavior | Use |
| --- | --- | --- |
| `require` | Encrypt and verify the server certificate | PostgreSQL behind a publicly trusted chain |
| `no-verify` | Encrypt without verifying the certificate | Supabase's pooler, which currently presents a self-signed chain |
| `disable` | Plaintext | Local development and PGlite-based tests |

Production uses the Supabase transaction pooler on port `6543` with `DATABASE_SSL=no-verify`. The connection is still TLS-encrypted; only certificate authentication is skipped. A dedicated `amr_app` login owns no other schema and has no superuser, database-creation, or role-creation rights.

### Runtime AI provider

The default requires no configuration:

```dotenv
AI_PROVIDER=mock
```

To use an OpenAI-compatible endpoint:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://127.0.0.1:1234/v1
AI_MODEL=your-model-name
# AI_API_KEY=...
AI_TIMEOUT_MS=60000
AI_MAX_RETRIES=2
AI_MAX_OUTPUT_TOKENS=8000
```

The adapter calls `POST {AI_BASE_URL}/chat/completions` (or uses the URL directly if it already ends in `/chat/completions`), sends a JSON-schema prompt, and accepts JSON content, including fenced JSON. The provider must support the configured model and a JSON-object response mode; otherwise generation fails safely and is reported as invalid output.

No provider, model, key, or media feature is assumed to exist. The optional adapter is implemented and covered by mocked-HTTP tests, not live-provider tests.

### Media

```dotenv
MEDIA_PROVIDER=static   # approved fictional SVG (default)
# MEDIA_PROVIDER=none   # written exhibit only
```

There is no live image/video adapter. If the static diagram cannot load, the UI keeps the written description and interpretation.

## Playing

### Sample

1. Open <http://localhost:5173>.
2. Choose **Play the sample case**.
3. The frontend posts `{ "sample": true }` to `POST /api/cases` with an idempotency key, then creates a game session.
4. Review suspects, exhibits, and the timeline. Opening an exhibit records progress; hints are limited to three.
5. Make one accusation. The backend locks it, scores it, and reveals the solution only through the authorized results endpoint.

The sample is repeatable and readable by any guest with its case ID. A **session** is private: its cookie holds `sessionId.token`, and only a hash of the token is stored server-side.

### Custom case

1. Open `/create`, write a fictional brief, and choose a category, difficulty, and optional evidence preferences.
2. Submit. The API returns `202` with a generation ID; the form locks and shows named stages as they are reported.
3. On success, the app opens the validated investigation room. No case is playable until validation, persistence, and the `ready` transition complete.
4. On failure, the app explains what failed, keeps the brief, and offers a retry with a fresh idempotency key or the sample as a fallback.
5. If progress polling is interrupted, the app offers **Check again** and does not resubmit the brief automatically.

Generated cases are private to the creating guest. Clearing cookies loses access.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build `shared`, then run API and Vite dev servers together |
| `npm run build` | Build `shared`, `backend`, and the production frontend bundle |
| `npm run typecheck` | Build `shared`, then typecheck backend and frontend |
| `npm run lint` | ESLint across the repository |
| `npm run test` | Build `shared`, then run backend and frontend unit/integration tests |
| `npm run test:backend` | Backend unit and PostgreSQL integration tests (PGlite over TCP) |
| `npm run test:frontend` | Frontend component and flow tests |
| `npm run test:e2e` | Build everything, then run Playwright with an ephemeral PGlite database |
| `npm run test:e2e:report` | Open the last Playwright HTML report |

Workspace commands are also available, e.g. `npm run test --workspace=@amr/backend`.

## Troubleshooting

- **The API exits at startup with a configuration error.** Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace `SESSION_SECRET` with a real random value. Configuration is validated once at startup.
- **The API reports `database: "disconnected"` or a connection error.** The dev server expects a real PostgreSQL. Start the local instance from [Setup](#setup) or point `DATABASE_URL` at a reachable database. Check `DATABASE_SSL`: PGlite and plain local PostgreSQL need `disable`, while Supabase's pooler needs `no-verify`. The automated tests start PGlite themselves and do not need this.
- **Startup fails with `permission denied for schema amr`.** Grant the application role `USAGE` and `CREATE` on `amr`, or run the API once with the schema owner to create the tables.
- **A custom brief fails immediately or reports a provider error.** Check `GET /api/health`. `AI_PROVIDER=mock` needs no configuration and is the default. `AI_PROVIDER=openai-compatible` requires `AI_BASE_URL` and `AI_MODEL`; a rejected or unreachable endpoint fails safely without publishing a partial case. The sample remains playable.
- **Port `4000` or `5173` is already in use.** Stop the other process. The Vite proxy targets `127.0.0.1:4000`, so changing the API port also requires updating `frontend/vite.config.ts`.
- **Playwright cannot launch Chromium.** Run `npx playwright install chromium`. The E2E stack starts its own PGlite database and needs no network access.
- **The production build prints Rollup `@__PURE__` notices from Zod.** These are third-party annotation warnings, not build failures.
- **A private custom case or session disappeared.** Access is cookie-scoped. Clearing cookies removes access; there are no accounts yet.

## API overview

All responses use a `{ "data": ... }` success envelope. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": [{ "field": "scenario", "message": "Scenario is too short." }],
    "requestId": "req_..."
  }
}
```

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Readiness; database state, configured AI/media mode, version. No secrets |
| `POST` | `/api/cases` | `{ "sample": true }` creates/reuses the sample (`201`/`200`). A custom brief returns `202` with a generation status, or `200` when an idempotent request is already ready |
| `GET` | `/api/cases/:caseId` | Public case view; no solution fields |
| `GET` | `/api/cases/:caseId/evidence` | Public exhibit metadata |
| `GET` | `/api/evidence/:evidenceId` | One public exhibit, including structured content |
| `GET` | `/api/generation/:generationId` | Owner-authorized generation status and safe failure message |
| `POST` | `/api/sessions` | Create a session for an accessible case; sets the session cookie |
| `GET` | `/api/sessions/:sessionId` | Authorized progress |
| `PATCH` | `/api/sessions/:sessionId/progress` | Record a viewed exhibit |
| `POST` | `/api/sessions/:sessionId/hints` | Spend a hint |
| `POST` | `/api/sessions/:sessionId/accusations` | Lock one accusation and return the scored result |
| `GET` | `/api/sessions/:sessionId/results` | Authorized result after completion |

Generation status values are `pending`, `validating`, `ready`, and `failed`. Stages are `queued`, `normalizing_brief`, `drafting_blueprint`, `repairing_blueprint`, `validating_case`, `publishing`, `published`, and `failed`.

## Project layout

```text
shared/    Zod request schemas, constants, and API types
backend/   Express API, PostgreSQL repositories, sample/generation pipelines, tests
frontend/  React + Vite UI, generation flow, investigation features, tests
e2e/       Playwright specs and the self-contained E2E stack
docs/      Architecture, testing notes, and decision records
```

See [`docs/architecture.md`](./docs/architecture.md) for request flow, generation stages, data boundaries, and authorization. Test inventory and observed results are in [`docs/testing.md`](./docs/testing.md). Decisions are recorded in [`docs/decisions/`](./docs/decisions/).

## Durability and scaling

- Generation jobs run inside the API process. The HTTP contract is asynchronous, but the worker is not durable.
- On startup, unfinished cases/jobs are marked failed and partial rows are removed. The client can then retry instead of polling forever.
- This recovery assumes a single API process owns the database at startup.
- Multiple API replicas, guaranteed delivery, and job survival during a restart require a durable queue and worker leases.
- Rate limits are in-memory and reset on restart; multi-instance deployment needs a shared store.

## Production deployment

The live deployment uses Vercel:

- [`vercel.json`](./vercel.json) builds the Vite frontend into `frontend/dist`, configures the Node.js function, and routes non-API paths to `index.html`.
- [`api/index.js`](./api/index.js) re-exports the prebuilt Express app from `backend/dist/vercel.js`. `vercel.json` rewrites every `/api/*` path to this function so Express receives the original nested URL.
- The Vercel project is linked to `heyshreee/ai-mystery-room`, so a push to `main` creates a production deployment without a separate deploy workflow.
- `AI_PROVIDER=mock` and `MEDIA_PROVIDER=static` keep generation deterministic and network-free. No live model or media provider is configured.

Required Vercel environment variables (Production and Preview):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase transaction-pooler connection string for the dedicated `amr_app` role. Store it as an encrypted variable. |
| `DATABASE_SSL` | `no-verify` for the Supabase pooler; the connection is encrypted but the self-signed chain is not verified. |
| `SESSION_SECRET` | Random value of at least 32 characters. |
| `FRONTEND_ORIGIN` | Comma-separated HTTPS origins allowed to send credentialed requests. Vercel's deployment hostnames are added automatically. |
| `TRUST_PROXY` | `1` on Vercel so Express trusts the platform proxy. |
| `AI_PROVIDER` | `mock` for the deterministic generator. |
| `MEDIA_PROVIDER` | `static` for the committed fictional evidence asset. |

Operational notes:

- Run `npm run build` locally to reproduce the deployment build. The serverless entry point is `backend/dist/vercel.js`; the standalone server remains `backend/dist/server.js`.
- Cookies become `Secure` in production, so the site must be served over HTTPS. Keep health checks on `GET /api/health`, ship structured logs to the platform, and avoid logging prompts or solutions.
- Do not expose PostgreSQL publicly. Use the pooler connection string, keep the application role least-privileged, configure backups and retention for cases and sessions, and test a restore before relying on it. User-written scenarios and generated cases can contain arbitrary text.
- Generation jobs run inside the API process. The HTTP contract is asynchronous, but the worker is not durable; use a durable queue and worker leases before relying on serverless restarts or multiple replicas.
- Rate limits are in-memory and reset on restart; multi-instance deployment needs a shared store.
- Verify the selected AI provider, model, quotas, and latency separately. `AI_PROVIDER=mock` is deterministic and network-free, not a live model.

## Verified status

Last verified: **2026-10-28** (Node 24, npm 11, WSL2)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed — 0 errors, 0 warnings |
| `npm run build` | Passed — shared/backend emitted; frontend bundle built |
| Backend tests | **75 passed** across 8 files |
| Frontend tests | **24 passed** across 5 files |
| Playwright E2E | **6 passed** across 2 files |
| Accessibility | Axe reports **zero** WCAG A/AA violations on landing, creation, investigation, accusation dialog, and results at desktop and mobile widths |
| Browser flow | Sample journey, correct and incorrect accusations with reveal, custom mock generation, generation failure/retry, mobile layout, and solution isolation passed |
| Dependency audit | `npm audit` reports **0 vulnerabilities** (production and full dependency trees) |
| Supabase preflight | **Passed** against the production database through the pooler: schema initialization, sample game loop, hints, accusation/results, 404s, custom mock generation to `ready`, and cleanup |
| GitHub Actions CI | Passed on `ab5bdce`; [run 40716492708](https://github.com/heyshreee/ai-mystery-room/actions/runs/40716492708) completed successfully |

### Deployment verification

The Postgres port is re-verified on the live deployment after it is pushed. Results are recorded here only after observing them.

| Check | Result |
| --- | --- |
| Vercel Git CD | Passed — a push to `main` created a production deployment for `ab5bdce` automatically |
| Static frontend | Passed — `/` and `/cases/xyz` return `200` HTML |
| Nested API routing | Passed — `/api/cases/:id` reaches Express. The first deployment exposed a platform-level 404 for nested `/api` paths; routing was changed to rewrite every `/api/*` request to one function. |
| Live API health | Passed — `GET /api/health` returns `200` with `database: "connected"`, `aiProvider: "mock"`, and `mediaProvider: "static"` |
| Live sample play | Passed — sample creation, case/evidence reads, session creation, progress, hint, correct accusation, and authorized results |
| Live custom generation | Passed — a custom brief returned `202`, polling reached `ready`, and the generated case was readable |
| Live error behavior | Passed — unknown case and unknown route return JSON `404`; a malformed case ID returns `400` |
| Test data cleanup | Passed — all live verification cases were deleted from `amr.cases`; the tables were empty afterward |

The live verification used the same Supabase project and `DATABASE_URL` configured for Production. It did not exercise a live model provider or live media generation.

The production frontend build emits Rollup notices about `@__PURE__` comments inside Zod's published files. They are third-party annotation warnings, not build failures.

## Known gaps

- **Live AI not verified** — select an endpoint/model/credentials and run a real-provider evaluation before claiming live generation.
- **No live media** — static diagram and text fallback only.
- **No durable queue** — single-process generation only; no horizontal worker scaling.
- **No load/performance or visual-regression tests.**
- **No backup/restore drill or provider-quota validation** — production storage is Supabase PostgreSQL, but restore and quota behavior have not been exercised.
- **Guest cookies, not accounts** — no recovery after cookie loss.
