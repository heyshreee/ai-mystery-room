# AI Mystery Room

AI Mystery Room is a fictional detective game. A guest submits a scenario or opens the hand-authored sample, studies suspects and exhibits, spends hints, and makes one final accusation. The complete game loop runs without a live AI provider: the default generator is deterministic and network-free.

`SPEC.md` remains the product source of truth. Phases 1–5 are implemented, including asynchronous custom generation, a provider-neutral runtime adapter, static fictional media, browser E2E, and accessibility checks. A live model endpoint has **not** been verified because no provider credentials are part of this repository.

## Live deployment

- **App:** <https://ai-mystery-room-git.vercel.app>
- **CI:** [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs lint, typecheck, build, backend/frontend tests, and Playwright on every push and pull request.
- **CD:** Vercel Git integration deploys `main` to production automatically.

The Vite frontend, SPA fallback, and serverless API entry point are deployed. The API is **not yet usable** because the Vercel project has no reachable production MongoDB: `GET /api/health` fails after the MongoDB selection timeout. Set `MONGODB_URI` to a hosted database in the Vercel project, redeploy, and verify `/api/health` returns `200` before treating the deployment as complete.

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
- MongoDB for local development and production-style runs
- Network access on the first test run so `mongodb-memory-server` can download/cache its test binary
- Chromium for Playwright (`npx playwright install chromium` if not already cached)

## Setup

```bash
npm install
cp .env.example .env
```

Generate a real session secret and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set `MONGODB_URI` if MongoDB is not at the default:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ai_mystery_room
```

Start MongoDB. For example:

```bash
mkdir -p .data/mongo
mongod --dbpath .data/mongo
```

Or with Docker:

```bash
docker run --rm -p 27017:27017 --name amr-mongo mongo:8
```

Then:

```bash
npm run dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>

Vite proxies `/api`, so browser requests are same-origin in development. `vite preview` uses the same proxy configuration for the E2E stack.

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
| `npm run test:backend` | Backend unit and MongoDB integration tests |
| `npm run test:frontend` | Frontend component and flow tests |
| `npm run test:e2e` | Build everything, then run Playwright with an ephemeral MongoDB |
| `npm run test:e2e:report` | Open the last Playwright HTML report |

Workspace commands are also available, e.g. `npm run test --workspace=@amr/backend`.

## Troubleshooting

- **The API exits at startup with a configuration error.** Copy `.env.example` to `.env`, set `MONGODB_URI`, and replace `SESSION_SECRET` with a real random value. Configuration is validated once at startup.
- **`MongooseServerSelectionError` or a database timeout.** The dev server expects a real MongoDB. Start the local instance from [Setup](#setup) or point `MONGODB_URI` at a reachable database. The automated tests use an ephemeral MongoDB and do not need this.
- **A custom brief fails immediately or reports a provider error.** Check `GET /api/health`. `AI_PROVIDER=mock` needs no configuration and is the default. `AI_PROVIDER=openai-compatible` requires `AI_BASE_URL` and `AI_MODEL`; a rejected or unreachable endpoint fails safely without publishing a partial case. The sample remains playable.
- **Port `4000` or `5173` is already in use.** Stop the other process. The Vite proxy targets `127.0.0.1:4000`, so changing the API port also requires updating `frontend/vite.config.ts`.
- **Playwright cannot launch Chromium.** Run `npx playwright install chromium`. The E2E stack downloads and caches MongoDB 8.0.4 on first use; ensure network access or pre-seed `backend/.cache/mongodb-binaries`.
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
backend/   Express API, MongoDB models, sample/generation pipelines, tests
frontend/  React + Vite UI, generation flow, investigation features, tests
e2e/       Playwright specs and the self-contained E2E stack
docs/      Architecture, testing notes, and decision records
```

See [`docs/architecture.md`](./docs/architecture.md) for request flow, generation stages, data boundaries, and authorization. Test inventory and observed results are in [`docs/testing.md`](./docs/testing.md). Decisions are recorded in [`docs/decisions/`](./docs/decisions/).

## Durability and scaling

- Generation jobs run inside the API process. The HTTP contract is asynchronous, but the worker is not durable.
- On startup, unfinished cases/jobs are marked failed and partial documents are removed. The client can then retry instead of polling forever.
- This recovery assumes a single API process owns the database at startup.
- Multiple API replicas, guaranteed delivery, and job survival during a restart require a durable queue and worker leases.
- Rate limits are in-memory and reset on restart; multi-instance deployment needs a shared store.

## Production deployment

The live deployment uses Vercel:

- [`vercel.json`](./vercel.json) builds the Vite frontend into `frontend/dist`, configures the Node.js function, and routes non-API paths to `index.html`.
- [`api/[...].js`](./api/[...].js) re-exports the prebuilt Express app from `backend/dist/vercel.js`.
- The Vercel project is linked to `heyshreee/ai-mystery-room`, so a push to `main` creates a production deployment without a separate deploy workflow.
- `AI_PROVIDER=mock` and `MEDIA_PROVIDER=static` keep generation deterministic and network-free. No live model or media provider is configured.

Required Vercel environment variables (Production and Preview):

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Reachable MongoDB connection string with authentication/TLS. **Currently a local placeholder; the API cannot start without a hosted value.** |
| `SESSION_SECRET` | Random value of at least 32 characters. |
| `FRONTEND_ORIGIN` | Comma-separated HTTPS origins allowed to send credentialed requests. Vercel's deployment hostnames are added automatically. |
| `TRUST_PROXY` | `1` on Vercel so Express trusts the platform proxy. |
| `AI_PROVIDER` | `mock` for the deterministic generator. |
| `MEDIA_PROVIDER` | `static` for the committed fictional evidence asset. |

Operational notes:

- Run `npm run build` locally to reproduce the deployment build. The serverless entry point is `backend/dist/vercel.js`; the standalone server remains `backend/dist/server.js`.
- Cookies become `Secure` in production, so the site must be served over HTTPS. Keep health checks on `GET /api/health`, ship structured logs to the platform, and avoid logging prompts or solutions.
- Do not expose MongoDB publicly. Configure backups and retention for cases and sessions, and test a restore before relying on it. User-written scenarios and generated cases can contain arbitrary text.
- Generation jobs run inside the API process. The HTTP contract is asynchronous, but the worker is not durable; use a durable queue and worker leases before relying on serverless restarts or multiple replicas.
- Rate limits are in-memory and reset on restart; multi-instance deployment needs a shared store.
- Verify the selected AI provider, model, quotas, and latency separately. `AI_PROVIDER=mock` is deterministic and network-free, not a live model.

## Verified status

Last verified: **2026-10-26** (Node 24, npm 11, WSL2)

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
| GitHub Actions CI | Passed on `4cb8650`; [run 40532964772](https://github.com/heyshreee/ai-mystery-room/actions/runs/40532964772) completed successfully |

### Deployment verification (2026-10-27)

| Check | Result |
| --- | --- |
| Vercel Git CD | Passed — a push to `main` created a production deployment automatically |
| Static frontend | Passed — `/` and `/cases/xyz` return `200` HTML |
| API entry point | Deployed, but **not usable** — `/api/health` returns `500 FUNCTION_INVOCATION_FAILED` after the ~10s MongoDB selection timeout because `MONGODB_URI` is still a local placeholder |

The production frontend build emits Rollup notices about `@__PURE__` comments inside Zod's published files. They are third-party annotation warnings, not build failures.

## Known gaps

- **Live AI not verified** — select an endpoint/model/credentials and run a real-provider evaluation before claiming live generation.
- **No live media** — static diagram and text fallback only.
- **No durable queue** — single-process generation only; no horizontal worker scaling.
- **No load/performance or visual-regression tests.**
- **Live API not verified** — the static frontend and Git-based CD are live, but the API is blocked on a production MongoDB URI. No backup/restore drill or provider-quota validation has been performed.
- **Guest cookies, not accounts** — no recovery after cookie loss.
