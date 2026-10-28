# AI Mystery Room — Product & Engineering Specification

**Document:** `SPEC.md`  
**Version:** 1.0.0  
**Status:** MVP specification  
**Purpose:** Single Source of Truth (SSOT) for implementation by OpenCode and human contributors  
**Last updated:** 2026-10-25

---

## 0. How to use this document

This document defines the expected product behavior, architecture, data contracts, security constraints, and acceptance criteria for AI Mystery Room.

- Read this file before making implementation changes.
- Treat requirements in this file as authoritative unless the project owner explicitly approves a change.
- Do not silently invent product behavior where requirements are ambiguous. Record the assumption and ask for a decision when it materially affects scope, security, cost, or user experience.
- Implement in small phases and keep tests aligned with the specification.
- If an approved decision changes the product, update this file in the same change as the implementation.
- Do not claim that a feature is complete until it has been implemented and verified.

### Requirement priority

- **P0 — Must:** Required for a safe, usable MVP.
- **P1 — Should:** Valuable for the MVP but can follow the critical path.
- **P2 — Later:** Out of MVP scope unless explicitly approved.

### Normative terms

“Must” means mandatory. “Should” means recommended unless a documented reason justifies otherwise. “May” means optional.

---

## 1. Product overview

### 1.1 Product name

**AI Mystery Room**

### 1.2 One-sentence description

An AI-assisted fictional detective game in which a player supplies a short scenario, investigates generated evidence, identifies a culprit, and receives a reasoned reveal of the solution.

### 1.3 Product vision

Turn a small user-provided story or scenario into a coherent, interactive mystery investigation. The system generates a fictional case containing suspects, motives, timelines, and evidence such as chat messages, images, witness statements, and CCTV-style records. The player reviews the evidence and submits an accusation.

### 1.4 Target users

- People who enjoy detective stories, puzzles, escape rooms, and deduction games.
- Friends who want to create and solve custom fictional mysteries.
- Players looking for short, replayable investigations.

### 1.5 Core experience

1. The user enters a scenario or story.
2. The user selects options such as difficulty, category, and preferred evidence types.
3. The backend generates a case blueprint and fixes the true culprit.
4. The system generates suspects, timeline events, and evidence consistent with the blueprint.
5. The backend validates the case for contradictions and solvability.
6. The player investigates the case and optionally requests hints.
7. The player submits one final accusation.
8. The backend evaluates the accusation and reveals the solution and reasoning.

### 1.6 Product principles

- **Fair deduction:** The solution must be supported by evidence the player can access.
- **Consistency over spectacle:** A smaller coherent case is better than a large contradictory one.
- **Server authority:** The backend owns the truth, game state, and score.
- **Transparent fiction:** Generated content is clearly presented as fictional.
- **Graceful degradation:** The game remains playable when image or video generation is unavailable.
- **Provider flexibility:** Runtime AI services must be replaceable without rewriting game logic.
- **Accessible interaction:** Players can use the game with keyboard, screen reader, desktop, or mobile.

---

## 2. Scope

### 2.1 MVP scope — P0

- Responsive landing page and case-creation flow.
- User-submitted scenario with validation and length limits.
- Configurable difficulty and mystery category.
- A case with 3–6 suspects.
- One canonical culprit selected before evidence generation.
- Case timeline and structured evidence.
- At least these evidence types:
  - Chat/message transcript displayed in a fictional messaging interface.
  - Witness or suspect statement.
  - Timeline or access-log record.
  - Image evidence where an image provider is configured; otherwise a labeled placeholder or textual exhibit.
  - CCTV-style log, transcript, or still-image description.
- Investigation interface with suspect profiles, evidence viewer, and timeline.
- Evidence viewed-state tracking.
- Optional hints with a configurable limit.
- Final accusation flow.
- Server-side correctness evaluation and solution reveal.
- Persistence in PostgreSQL.
- AI provider abstraction, bounded retries, timeout handling, and invalid-output validation.
- Seeded sample case so the app is usable without an AI provider.
- Automated tests for the core game loop and critical security rules.
- Environment variable example and setup documentation.

### 2.2 Later scope — P1/P2

Unless explicitly approved, do not block MVP on these features:

- User accounts, OAuth, and cloud-synced history.
- Multiplayer or collaborative investigation.
- User-generated public case marketplace.
- Leaderboards and social sharing.
- Real-time generated video or animated CCTV.
- Voice acting, sound design, and music.
- Payments, subscriptions, and monetization.
- Mobile native applications.
- Community moderation workflows beyond basic input safety.
- Long-term player analytics.

### 2.3 Non-goals

- This is not a real forensic or law-enforcement tool.
- It must not claim that generated messages, images, or surveillance records are authentic.
- It must not access a user's real WhatsApp account, camera, microphone, or private messages.
- It must not execute AI-generated code or scripts.
- It must not require a paid AI service to run the deterministic sample case.
- It must not promise unlimited generation. Runtime model and media providers may impose rate limits, quotas, latency, and cost.

---

## 3. Assumptions and decisions to confirm

These are initial assumptions for implementation. Change them only with an explicit product decision.

| Topic | MVP assumption |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (Supabase in production; PGlite in tests) |
| API style | REST under `/api` |
| AI coding tool | OpenCode is used by the developer to build and maintain the project |
| Runtime AI | A separately configured model API or local inference endpoint |
| Authentication | Guest play using a securely generated session token; account system deferred |
| Case generation | Synchronous request initially, with clear loading state and bounded timeout; move to a job queue if provider latency requires it |
| Media generation | Optional adapter; textual evidence and sample assets keep the game playable without it |
| Number of suspects | 3–6, with a default of 4 |
| Accusations | One final accusation per game session in the MVP |
| Hints | Limited, server-controlled, and recorded in session state |
| Language | English for MVP |
| Hosting | Any compatible frontend host, Node host, and PostgreSQL service |
| Case visibility | A case is private to its creator/session unless public sharing is explicitly added later |

Before implementing a major feature, OpenCode should surface any assumption that has become consequential.

---

## 4. Technology and architecture

### 4.1 Required stack

**Frontend**
- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- A typed API client using `fetch` or a lightweight HTTP library
- Zod for shared/request data validation where appropriate

**Backend**
- Node.js LTS compatible with deployment platform
- Express
- TypeScript
- PostgreSQL via `pg` (Supabase pooler in production)
- Zod for request and AI-output validation
- Structured logging
- A security middleware stack, including secure headers and rate limiting

**Testing**
- Vitest
- React Testing Library
- Supertest
- Playwright for critical end-to-end flows

Use compatible, maintained dependency versions. Do not install a library solely because it is fashionable; explain the need for significant dependencies.

### 4.2 High-level architecture

```text
Browser
  |
  | HTTPS / REST JSON
  v
React + Vite frontend
  |
  v
Express API
  |-- Request validation and rate limits
  |-- Case generation orchestration
  |-- Game/session service
  |-- Evidence and solution service
  |-- Scoring and hint service
  |
  +--> AI Provider Adapter ---> Configured text model API/local endpoint
  |
  +--> Media Provider Adapter -> Optional image/video provider
  |
  +--> PostgreSQL (isolated `amr` schema)
```

### 4.3 Architectural rules

- Keep business logic out of React components and Express route handlers.
- Route handlers should validate input, invoke services, and format responses.
- Put mystery construction and validation in testable backend modules.
- Put provider-specific request formats behind adapters.
- Store provider keys only in backend environment variables.
- The frontend must never receive the canonical solution before the reveal state.
- Do not trust client-provided scores, culprit IDs, hint counts, or completion status.
- Use explicit types for API requests and responses.
- Avoid premature microservices. A modular monolith is the MVP architecture.

### 4.4 Suggested repository structure

```text
ai-mystery-room/
├── SPEC.md
├── README.md
├── .gitignore
├── .env.example
├── package.json                 # optional workspace root
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── case-creation/
│       │   ├── investigation/
│       │   ├── evidence/
│       │   ├── accusation/
│       │   └── results/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── services/
│       ├── types/
│       └── styles/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.ts
│       ├── server.ts
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       │   ├── case-generation/
│       │   ├── game-session/
│       │   ├── evidence/
│       │   ├── hints/
│       │   └── scoring/
│       ├── providers/
│       │   ├── ai/
│       │   └── media/
│       ├── models/
│       ├── schemas/
│       ├── utils/
│       └── tests/
├── shared/
│   └── src/                     # shared types/schemas if workspace setup is used
└── docs/
    ├── architecture.md
    └── decisions/
```

This structure is guidance, not a reason to reorganize an existing repository unnecessarily. Inspect the repository first.

---

## 5. User journeys

### 5.1 Create a case

1. Open the landing page.
2. Select **Create a Mystery**.
3. Enter a scenario.
4. Select category, difficulty, and evidence preferences.
5. Review the fiction/safety notice.
6. Submit the form.
7. See a progress state while the case is generated.
8. On success, open the investigation room.
9. On failure, see a useful error and retry option. Never display a broken partial case as playable.

### 5.2 Investigate

1. Read the case summary and incident timeline.
2. Review the suspect list.
3. Open each suspect's profile and statement.
4. Open evidence items and inspect their details.
5. Compare timestamps, claims, locations, and contradictions.
6. Request a hint if desired.
7. Select a suspect when ready to accuse.

### 5.3 Submit an accusation

1. Open the accusation panel.
2. Select exactly one suspect.
3. Optionally provide a short explanation, if enabled.
4. Confirm the final accusation.
5. Backend validates the session and locks the accusation.
6. Backend calculates the result.
7. Display correct/incorrect result, score, and solution explanation.
8. Allow the player to start a new case.

### 5.4 Resume a session

The MVP may support refresh/resume using a guest-session token. The server must verify the token and session ownership. Do not put secrets or solution data in local storage. If durable guest sessions are not implemented, clearly state that progress may be lost when the session ends.

---

## 6. Functional requirements

### 6.1 Case creation

- **FR-001 (P0):** Accept a scenario string with a configurable minimum and maximum length. Suggested MVP limits: 30–2,000 characters.
- **FR-002 (P0):** Accept a category from a server-defined enum.
- **FR-003 (P0):** Accept a difficulty from `easy`, `medium`, or `hard`.
- **FR-004 (P0):** Accept supported evidence preferences without allowing arbitrary provider instructions.
- **FR-005 (P0):** Reject empty, excessively long, malformed, or disallowed input with field-level errors.
- **FR-006 (P0):** Display a fiction notice before case creation.
- **FR-007 (P0):** Create a traceable generation ID and generation status.
- **FR-008 (P0):** Prevent duplicate case creation from accidental repeated submissions using idempotency or client-side submission locking.

### 6.2 Case construction

- **FR-010 (P0):** Generate a title, summary, incident, location, incident time, and case rules.
- **FR-011 (P0):** Generate 3–6 distinct suspects.
- **FR-012 (P0):** Give each suspect a stable ID, profile, motive, opportunity, statement, and relationship information.
- **FR-013 (P0):** Select and persist exactly one canonical culprit before generating evidence.
- **FR-014 (P0):** Generate a canonical timeline before generating dependent evidence.
- **FR-015 (P0):** Ensure the solution can be inferred from accessible evidence.
- **FR-016 (P0):** Validate generated output against strict schemas.
- **FR-017 (P0):** Do not publish a case until required validation succeeds.
- **FR-018 (P0):** Use bounded retries. If validation still fails, return a safe generation failure or use a validated sample case only if the user is told that a sample was substituted.
- **FR-019 (P1):** Save generation metadata such as provider name, model identifier, prompt version, elapsed time, and validation outcome without logging secrets or unnecessary personal data.

### 6.3 Evidence

- **FR-020 (P0):** Every evidence item has a stable ID, type, title, content, source, timestamp or explicit unknown time, and case ID.
- **FR-021 (P0):** Evidence references only valid suspect IDs and timeline events.
- **FR-022 (P0):** Support text evidence independently of media-provider availability.
- **FR-023 (P0):** Track which evidence a session has viewed.
- **FR-024 (P0):** Show evidence provenance as in-world fictional provenance, not as a claim that the item is real.
- **FR-025 (P0):** Avoid clues that disclose the culprit merely through a UI label or hidden metadata exposed to the browser.
- **FR-026 (P1):** Support optional image assets through a media provider or approved static sample assets.
- **FR-027 (P1):** Support CCTV-style evidence through logs, transcripts, descriptions, or still images.
- **FR-028 (P2):** Support generated video only when an actual configured provider can deliver it reliably and within budget.

### 6.4 Investigation

- **FR-030 (P0):** Display case summary, suspects, timeline, and evidence.
- **FR-031 (P0):** Allow filtering or grouping evidence by type and time where useful.
- **FR-032 (P0):** Show loading, empty, error, and retry states.
- **FR-033 (P0):** Track evidence viewed by the current session on the backend.
- **FR-034 (P0):** Provide keyboard-accessible navigation and controls.
- **FR-035 (P1):** Allow players to mark evidence as important or take private notes.

### 6.5 Hints

- **FR-040 (P0):** Hints are associated with a case and authored/validated against its canonical solution.
- **FR-041 (P0):** The server determines whether a hint is available and increments the hint count.
- **FR-042 (P0):** Hints reveal reasoning progressively rather than immediately naming the culprit.
- **FR-043 (P0):** The hint limit is configurable. Suggested default: three hints per session.
- **FR-044 (P0):** Hint requests are rate-limited and cannot be used to retrieve the hidden solution through repeated prompts.

### 6.6 Accusation and scoring

- **FR-050 (P0):** A session may submit one final accusation in the MVP.
- **FR-051 (P0):** Validate that the selected suspect belongs to the current case.
- **FR-052 (P0):** Calculate correctness on the server using the stored canonical culprit ID.
- **FR-053 (P0):** Lock the result so repeated requests cannot change the accusation.
- **FR-054 (P0):** Reveal the culprit, explanation, and supporting evidence only after the accusation is finalized or another explicitly authorized reveal condition occurs.
- **FR-055 (P0):** Return a score and breakdown that can be independently tested.
- **FR-056 (P0):** Do not accept a score supplied by the client.
- **FR-057 (P1):** Add optional explanation-quality scoring later; if AI is used, it must not override basic culprit correctness.

Suggested MVP scoring, to be implemented deterministically:

- Correct culprit: 100 points.
- Each hint used: subtract 10 points.
- Optional time bonus: omit from MVP to avoid inconsistent or unfair scoring.
- Clamp the score to a minimum of 0.
- Incorrect culprit: 0 points.

If the product owner changes scoring, update the spec and tests together.

---

## 7. AI and media generation design

### 7.1 OpenCode versus runtime AI

OpenCode is the coding agent used during software development. It is **not automatically the model API that serves end users**.

The website needs a separately configured runtime provider. This may be:
- A hosted model API.
- A local inference server.
- Another compatible provider implemented behind the application interface.

Do not hardcode a provider throughout the codebase. Do not assume a provider, API key, model, image-generation feature, or video-generation feature exists until configured and tested.

### 7.2 Provider interfaces

Create a provider-neutral interface similar to:

```ts
export interface AIProvider {
  generateStructured<T>(input: {
    systemPrompt: string;
    userPrompt: string;
    schemaName: string;
    schema: unknown;
    temperature?: number;
    timeoutMs: number;
  }): Promise<T>;
}

export interface MediaProvider {
  generateImage?(input: {
    prompt: string;
    aspectRatio?: string;
  }): Promise<{ url: string; mimeType: string }>;

  generateVideo?(input: {
    prompt: string;
    durationSeconds?: number;
  }): Promise<{ url: string; mimeType: string }>;
}
```

These are conceptual contracts. Adapt them to the selected SDK and its actual capabilities. Validate all returned data before use.

### 7.3 Generation pipeline

The pipeline must be explicit and testable:

1. Validate user scenario and options.
2. Normalize the scenario and create a generation record.
3. Produce a structured case blueprint.
4. Validate blueprint fields and scenario alignment.
5. Fix the canonical culprit, motive, method, opportunity, and timeline.
6. Generate suspect profiles and statements.
7. Generate evidence tied to canonical timeline events.
8. Generate progressive hints tied to validated clues.
9. Run deterministic consistency checks.
10. Optionally request a model critique of the case, but do not rely on critique alone.
11. Retry or repair specific invalid parts within a configured limit.
12. Persist the case, solution, and evidence transactionally where practical.
13. Publish only after required validations pass.

### 7.4 Canonical blueprint

The blueprint should contain:
- Case title and summary.
- Incident details.
- Setting and timezone convention.
- Canonical timeline with stable event IDs.
- Suspect identities and relationships.
- Culprit ID.
- Motive and method.
- Opportunity constraints.
- Alibi claims.
- Facts that are true, false, or unknown.
- Required clues and what each clue supports.
- Alternative-suspect red herrings.
- Solution explanation.
- Progressive hints.
- Content safety flags.

### 7.5 Evidence consistency rules

At minimum, validate the following:

- Every referenced suspect exists.
- Every evidence item belongs to the correct case.
- Timeline order is valid and timestamps use a consistent convention.
- A suspect cannot be in two incompatible locations at the same time unless the story explicitly explains it.
- Statements that contradict the truth are intentional, attributable, and resolvable.
- The evidence supports the canonical culprit without requiring hidden knowledge.
- Red herrings are plausible but do not make the case logically unsolvable.
- At least two independent clues should support the central deduction for ordinary cases.
- The solution explanation references real evidence IDs that the player can access.
- No evidence item accidentally names the culprit in a public title, filename, URL, or client-visible field.
- Difficulty changes clue subtlety and number of steps, not the fundamental fairness of the puzzle.

AI review can identify possible issues, but deterministic checks and test cases are mandatory.

### 7.6 Evidence types

Use a controlled enum such as:

```ts
type EvidenceType =
  | "chat_transcript"
  | "image"
  | "cctv_log"
  | "cctv_transcript"
  | "witness_statement"
  | "suspect_statement"
  | "access_log"
  | "document"
  | "timeline_event";
```

A fictional messaging exhibit may contain sender, recipient/group, message text, timestamp, and attachment references. It must be labeled as simulated and must not imply access to actual messaging accounts.

An image exhibit may contain an image URL, alt text, caption, generation status, and a textual interpretation. Do not claim the image proves something that is not actually visible or supported by the case logic.

CCTV evidence may be a transcript, timestamped log, still image, or optional video. If video generation is unavailable, the rest of the mystery must still be playable.

### 7.7 Provider failures and cost controls

- Set explicit timeouts.
- Bound retries and total generation tokens where supported.
- Apply per-session and per-IP rate limits, with appropriate proxy configuration.
- Record provider failure categories without storing API secrets.
- Never retry indefinitely.
- Do not silently claim that media was generated when a placeholder was returned.
- Show generation progress and a useful retry message.
- Configure provider/model selection and limits through environment variables.
- Track approximate usage and cost if the provider exposes it.
- Do not promise “free,” “unlimited,” or “no limits”; those depend on actual provider quotas and infrastructure.

---

## 8. Data model

Use PostgreSQL tables with explicit DDL and indexes in an isolated `amr` schema. The API applies the idempotent schema on startup. All rows have created/updated timestamps where relevant.

### 8.1 Case

Suggested fields:

```ts
interface CaseDocument {
  _id: string;
  title: string;
  scenario: string;
  summary: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  status: "generating" | "validating" | "ready" | "failed";
  creatorSessionId: string;
  suspectIds: string[];
  evidenceIds: string[];
  generationVersion: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Never put the canonical culprit or hidden solution in a public case response. The internal database may reference a separate solution record.

### 8.2 Suspect

```ts
interface SuspectDocument {
  _id: string;
  caseId: string;
  displayName: string;
  role: string;
  profile: string;
  motiveSummary: string;
  opportunitySummary: string;
  publicStatement: string;
  relationshipSummaries: Array<{
    otherSuspectId: string;
    relationship: string;
  }>;
  portraitAssetId?: string;
  createdAt: Date;
}
```

Do not send internal truth labels, hidden motive details, or culprit flags to the client.

### 8.3 Evidence

```ts
interface EvidenceDocument {
  _id: string;
  caseId: string;
  type: EvidenceType;
  title: string;
  publicDescription: string;
  content: Record<string, unknown>;
  occurredAt?: Date;
  sourceLabel: string;
  reliability: "low" | "medium" | "high" | "unknown";
  relatedSuspectIds: string[];
  relatedTimelineEventIds: string[];
  mediaStatus?: "not_required" | "pending" | "ready" | "failed";
  mediaUrl?: string;
  altText?: string;
  createdAt: Date;
}
```

Keep internal clue meaning and hidden truth metadata in a private solution/clue collection or backend-only fields excluded from all public serialization.

### 8.4 Solution

```ts
interface SolutionDocument {
  _id: string;
  caseId: string;
  culpritSuspectId: string;
  canonicalTimeline: Array<{
    eventId: string;
    at: string;
    location: string;
    description: string;
    involvedSuspectIds: string[];
  }>;
  motive: string;
  method: string;
  explanation: string;
  supportingEvidenceIds: string[];
  hintTexts: string[];
  validationStatus: "pending" | "valid" | "invalid";
  createdAt: Date;
}
```

This collection is backend-only. Do not expose it through a general case endpoint.

### 8.5 Game session

```ts
interface GameSessionDocument {
  _id: string;
  caseId: string;
  guestTokenHash: string;
  status: "investigating" | "completed" | "expired";
  viewedEvidenceIds: string[];
  hintsUsed: number;
  accusationSuspectId?: string;
  isCorrect?: boolean;
  score?: number;
  startedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}
```

Store a hash of a sufficiently random guest token, not the raw token, where feasible. Use expiration policies appropriate to the intended session lifecycle.

### 8.6 Generation job (recommended)

Track generation ID, case ID if created, status, stage, attempts, safe error code, provider identifier, prompt/schema version, timestamps, and expiration. Do not store provider secrets or unnecessary raw personal data.

### 8.7 Indexes and integrity

- Index case status and creation time for listing/maintenance.
- Index evidence by `caseId` and type.
- Index sessions by case and expiration.
- Use unique or idempotency constraints where needed.
- Validate all ID references.
- Expire sessions by checking `expires_at`; there is no database TTL job.
- Avoid returning raw database rows directly. Use explicit response DTOs.

---

## 9. REST API contract

All endpoints use the `/api` prefix and JSON unless explicitly returning media. Responses should have a consistent error format.

### 9.1 Standard response/error shape

Success responses should be typed and documented. Error example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "details": [
      { "field": "scenario", "message": "Scenario is too short." }
    ],
    "requestId": "req_example"
  }
}
```

Never return stack traces, provider secrets, raw prompts containing sensitive data, or internal solution fields to clients.

### 9.2 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health/readiness check without secrets |
| POST | `/api/cases` | Validate scenario and start case generation |
| GET | `/api/cases/:caseId` | Get safe public case data |
| GET | `/api/cases/:caseId/evidence` | List public evidence metadata |
| GET | `/api/evidence/:evidenceId` | Get a specific public evidence item |
| POST | `/api/sessions` | Create a session for a ready case |
| GET | `/api/sessions/:sessionId` | Get authorized session progress |
| PATCH | `/api/sessions/:sessionId/progress` | Record viewed evidence or permitted progress |
| POST | `/api/sessions/:sessionId/hints` | Request next hint |
| POST | `/api/sessions/:sessionId/accusations` | Submit final accusation |
| GET | `/api/sessions/:sessionId/results` | Retrieve authorized results after completion |
| GET | `/api/generation/:generationId` | Check generation status if asynchronous generation is used |

### 9.3 Request and response requirements

**POST `/api/cases`** request:

```json
{
  "scenario": "A valuable painting disappeared during a private museum event.",
  "category": "theft",
  "difficulty": "medium",
  "evidencePreferences": ["chat_transcript", "witness_statement", "cctv_log"]
}
```

Response may return a ready case or a generation ID with status, depending on implementation. The API contract must be consistent and documented. Do not pretend that a background job exists unless it has been implemented.

**POST `/api/sessions`** request:

```json
{
  "caseId": "valid-case-id"
}
```

Return a session identifier and the guest session credential using a secure delivery approach. Do not put long-lived secrets in URLs.

**PATCH `/api/sessions/:sessionId/progress`** request:

```json
{
  "viewedEvidenceId": "valid-evidence-id"
}
```

The backend validates that the evidence belongs to the case in the session.

**POST `/api/sessions/:sessionId/hints`** request:

```json
{}
```

The server chooses the next hint and enforces the limit.

**POST `/api/sessions/:sessionId/accusations`** request:

```json
{
  "suspectId": "valid-suspect-id"
}
```

The client must not send a correctness flag or score. The server verifies the suspect belongs to the case, checks session status, locks the result, and calculates the score.

### 9.4 API security rules

- Validate path parameters, query parameters, headers, and request bodies.
- Enforce session ownership on every session-specific endpoint.
- Rate-limit expensive generation and hint endpoints.
- Prevent cross-case evidence and suspect ID substitution.
- Reject repeated accusations after completion.
- Return a generic not-found or forbidden response where revealing resource existence would be unsafe.
- Configure CORS explicitly for known frontend origins.
- Use HTTPS in production.
- Set safe request size limits and request timeouts.
- Generate a request ID for debugging.

---

## 10. Frontend and UX specification

### 10.1 Visual direction

Use a cinematic detective-room aesthetic without sacrificing readability:
- Dark charcoal or near-black surfaces.
- Restrained brass, warm white, or muted red accents.
- Clear typography and strong hierarchy.
- Evidence cards resembling case files, exhibits, logs, and transcripts.
- Subtle motion only when it communicates state.
- No fake user reviews, fabricated popularity metrics, or misleading claims.
- Do not make color the only way to communicate evidence status.

Exact colors and typography may be chosen during design implementation, then documented in design tokens.

### 10.2 Required screens

**Screen A — Landing page**
- Product name and concise explanation.
- Primary action: Create a Mystery.
- Secondary action: Play a sample case.
- Fiction disclaimer.
- Responsive navigation.

**Screen B — Case creation**
- Scenario textarea with character count.
- Category selector.
- Difficulty selector.
- Evidence preferences.
- Validation feedback.
- Submit/loading state.
- Retry and failure states.

**Screen C — Generation progress**
- Current stage or neutral progress indicator.
- No fake percentage unless real progress can be measured.
- Recoverable error state and retry action.
- Prevent duplicate submissions.

**Screen D — Investigation room**
- Case summary and incident facts.
- Suspect list and profile panel.
- Evidence list/filter.
- Evidence detail viewer.
- Timeline.
- Hints panel.
- Accusation action.
- Clear indication of viewed evidence.

**Screen E — Accusation confirmation**
- Suspect selection.
- Confirmation that this is the final accusation.
- Cancel/back action before submission.
- Disable submission while the request is pending.

**Screen F — Results**
- Correct or incorrect verdict.
- Canonical culprit.
- Explanation tied to accessible evidence.
- Score breakdown and hint penalty.
- Play-again action.

### 10.3 Required UX states

Every asynchronous feature must have:
- Idle state.
- Loading state.
- Success state.
- Empty state where relevant.
- Recoverable error state.
- Retry behavior where safe.
- Disabled state during duplicate-sensitive submissions.

### 10.4 Accessibility and responsive behavior

- Semantic HTML and meaningful headings.
- Visible keyboard focus.
- Full keyboard operation for all game-critical controls.
- Appropriate labels and accessible names.
- Dialog focus management.
- Text alternatives for images and media.
- Adequate contrast.
- Reduced-motion support.
- Responsive layout at mobile, tablet, and desktop widths.
- Avoid hover-only controls.

---

## 11. Security, privacy, and safety

### 11.1 Secrets and configuration

- Commit `.env.example`, never real `.env` files or credentials.
- Keep model API keys, database credentials, signing secrets, and provider tokens on the server.
- Validate required environment variables at startup.
- Never send server environment values to Vite client bundles.
- Rotate any credential accidentally committed to source control.

### 11.2 Input and prompt-injection handling

- Treat user scenarios and generated content as untrusted data.
- System instructions must define a fictional puzzle-generation task and output schema.
- User text must not override provider/system constraints or request secret disclosure.
- Never use generated text as executable code, a shell command, a database query, or raw HTML.
- Escape user/model text at rendering boundaries.
- Validate generated structured output before persistence.
- Apply content safety checks appropriate to the app's audience and intended rating.

### 11.3 API and database

- Use least-privilege database credentials.
- Validate ownership and relationships for every ID.
- Rate-limit expensive operations.
- Apply secure HTTP headers.
- Configure CORS with an allowlist.
- Avoid logging full user prompts or generated private case content unless needed and disclosed.
- Sanitize logs and errors.
- Add database backups and retention policies appropriate to deployment.
- Keep dependencies patched.

### 11.4 Fiction and generated media

- Label all generated case content and media as fictional or simulated.
- Do not impersonate real people or create misleading claims that generated content is authentic evidence.
- Do not access actual messaging accounts or surveillance systems.
- Use synthetic names and fictional settings by default.
- If user-uploaded media is introduced later, it requires a separate security, consent, storage, and moderation design.

### 11.5 Guest-session security

- Generate a cryptographically random, sufficiently long session token.
- Do not expose it in shareable URLs or logs.
- Prefer an HttpOnly, Secure, SameSite cookie when deployment architecture supports it; if using an authorization header, protect the token and document its storage lifecycle.
- Store a hash of the token server-side where feasible.
- Enforce expiration and ownership checks.
- Protect cookie-authenticated state-changing endpoints against CSRF as appropriate.

---

## 12. Non-functional requirements

- **NFR-001 Reliability:** Invalid AI output must not become a playable case.
- **NFR-002 Security:** No public API response may expose the hidden solution before reveal.
- **NFR-003 Performance:** Normal non-generation API calls should target a p95 response time under 500 ms in a representative deployment, excluding database cold starts and external provider latency.
- **NFR-004 Generation UX:** Show a clear loading state while external generation is running; enforce configured timeouts.
- **NFR-005 Accessibility:** Meet practical WCAG 2.2 AA-oriented requirements for contrast, focus, keyboard access, and labels.
- **NFR-006 Maintainability:** Keep provider integrations, game rules, persistence, and UI concerns separated.
- **NFR-007 Observability:** Use structured logs, request IDs, safe error codes, and generation-stage status.
- **NFR-008 Cost control:** Bound generation retries, request size, rate, and provider usage.
- **NFR-009 Portability:** Local development must work with documented environment variables and a sample case even if no model provider is configured.
- **NFR-010 Privacy:** Collect only data needed for the game and document retention behavior.
- **NFR-011 Responsive UI:** Support common mobile, tablet, and desktop viewports.
- **NFR-012 Type safety:** Use TypeScript and runtime validation at trust boundaries.

Performance targets should be measured and revised based on the actual deployment environment.

---

## 13. Error handling and observability

Use stable error codes such as:
- `VALIDATION_ERROR`
- `CASE_NOT_FOUND`
- `CASE_NOT_READY`
- `GENERATION_FAILED`
- `GENERATION_TIMEOUT`
- `AI_PROVIDER_UNAVAILABLE`
- `INVALID_AI_OUTPUT`
- `SESSION_NOT_FOUND`
- `SESSION_EXPIRED`
- `SESSION_COMPLETED`
- `EVIDENCE_NOT_FOUND`
- `HINT_LIMIT_REACHED`
- `INVALID_ACCUSATION`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Requirements:
- Errors shown to players should be understandable and should not expose implementation details.
- Logs should include request ID, route, safe error code, and duration.
- Provider logs must not include API keys.
- Track generation stage and validation failures.
- Do not log the canonical solution in general request logs.
- Provide a health endpoint that does not reveal configuration secrets.

---

## 14. Testing strategy

### 14.1 Unit tests

Test:
- Scenario and API schema validation.
- Canonical culprit selection.
- Timeline and reference validation.
- Evidence/suspect relationships.
- Case solvability rules.
- Hint progression and limits.
- Score calculation.
- Accusation locking and idempotency.
- Public DTOs excluding solution fields.

### 14.2 Integration tests

Test:
- Case generation using a mocked AI provider.
- Invalid structured output and retry limits.
- Provider timeout and provider outage.
- PostgreSQL persistence and referential integrity.
- Session authorization.
- Cross-case ID substitution attempts.
- Evidence progress persistence.
- Hint and accusation endpoints.
- Result endpoint behavior before and after completion.

### 14.3 End-to-end tests

At minimum:
1. Open landing page and start sample case.
2. Inspect suspects and evidence.
3. Request a hint.
4. Submit a correct accusation and verify reveal.
5. Submit an incorrect accusation in another session and verify reveal.
6. Attempt to access solution before completion and verify it is not exposed.
7. Simulate generation failure and verify retry/error UI.
8. Verify critical flows at mobile and desktop viewport sizes.

### 14.4 Test rules

- Use deterministic fixtures and mock provider responses.
- Never depend on a live paid model provider in the default test suite.
- Keep a small validated sample mystery in the repository.
- Test both correct and incorrect accusation paths.
- Test that client-supplied score/correctness fields are ignored or rejected.
- Run type checking, linting, unit/integration tests, and production builds before marking a phase complete.

---

## 15. Environment configuration

Provide a documented `.env.example` similar to:

```dotenv
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
DATABASE_SSL=disable

# Runtime AI provider: configure only after selecting a real provider.
AI_PROVIDER=mock
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_TIMEOUT_MS=60000
AI_MAX_RETRIES=2

# Optional media provider.
MEDIA_PROVIDER=none
MEDIA_API_BASE_URL=
MEDIA_API_KEY=
MEDIA_IMAGE_MODEL=
MEDIA_VIDEO_MODEL=

# Session/security values: generate real random secrets locally.
SESSION_SECRET=replace_with_a_long_random_secret
SESSION_TTL_HOURS=24

# Rate limits and generation safeguards.
CASE_GENERATION_LIMIT_PER_HOUR=5
MAX_SCENARIO_LENGTH=2000
MAX_GENERATION_ATTEMPTS=3
```

Rules:
- The exact variable names may be adapted to the chosen provider, but update this file and README together.
- `AI_PROVIDER=mock` must use deterministic fixtures and must not pretend to call a live model.
- Never use the sample session secret in production.
- Do not commit a real API key.
- Validate configuration on startup and fail with a clear, non-secret error if required settings are missing.
- The backend is the only place allowed to read runtime AI/media secrets.

---

## 16. Local development and deployment

### 16.1 Local development

README must explain:
1. Prerequisites and supported Node version.
2. How to install dependencies.
3. How to start PostgreSQL locally or configure `DATABASE_URL`.
4. How to copy `.env.example` to a local environment file.
5. How to run frontend and backend in development.
6. How to run lint, type-check, tests, and production builds.
7. How to run the deterministic sample case.
8. How to configure a runtime AI provider.
9. How to configure optional media generation.
10. Common troubleshooting steps.

### 16.2 Production deployment

- Deploy frontend and backend with explicit environment configuration.
- Set the production frontend origin in CORS configuration.
- Use HTTPS and a managed PostgreSQL deployment or secured database.
- Configure health checks, timeouts, and logging.
- Do not expose PostgreSQL publicly without appropriate access controls.
- Configure provider quotas and rate limits.
- Test the deployed build with both sample and AI-generated cases.
- Document database backup and recovery procedures.
- Do not assume a deployment platform supports long-running requests or large media files without verification.

---

## 17. Phased implementation plan

### Phase 0 — Repository audit and plan

- Inspect current repository and git state.
- Read this specification fully.
- Identify existing components and dependencies worth retaining.
- Report gaps and propose a plan before major changes.
- Confirm any material unresolved decisions.

**Exit criteria:** A concise implementation plan and gap report exist.

### Phase 1 — Project foundation

- Establish frontend/backend structure and TypeScript.
- Configure environment validation.
- Connect PostgreSQL and apply the idempotent `amr` schema.
- Add API error handling, logging, and health endpoint.
- Build shared types and request schemas.
- Create a coherent design system and navigation.

**Exit criteria:** App starts locally, health check passes, and basic validation/tests run.

### Phase 2 — Deterministic game engine

- Create a validated sample mystery fixture.
- Implement case/suspect/evidence/session models.
- Build the investigation interface.
- Implement viewed evidence and hints.
- Implement final accusation, server scoring, and reveal.
- Ensure solution isolation from public responses.

**Exit criteria:** The entire core game loop works without any live AI provider.

### Phase 3 — Runtime AI integration

- Implement AI provider interface and one selected provider adapter.
- Add structured blueprint and evidence generation.
- Add deterministic validation and bounded retries.
- Add generation status and error states.
- Add mocked provider tests.

**Exit criteria:** Valid cases can be generated and invalid cases are not published.

### Phase 4 — Media and UX

- Add fictional chat transcript presentation.
- Add image provider adapter or approved static image fallback.
- Add CCTV-style logs/transcripts and optional stills.
- Refine timeline, filtering, hints, and responsive layout.
- Add accessibility improvements.

**Exit criteria:** All configured evidence types render correctly and failures degrade gracefully.

### Phase 5 — Hardening and release

- Complete unit, integration, and end-to-end tests.
- Run dependency and security checks.
- Verify environment and deployment settings.
- Test production build and real deployment.
- Finish README, troubleshooting, and operational notes.

**Exit criteria:** Acceptance criteria in Section 18 pass.

---

## 18. Definition of done and acceptance criteria

The MVP is complete only when the following are demonstrably true.

### Product behavior

- [ ] A user can enter a custom scenario and valid options.
- [ ] Invalid input is rejected with clear messages.
- [ ] A playable case has 3–6 distinct suspects.
- [ ] Exactly one canonical culprit is fixed before evidence generation.
- [ ] Evidence references valid suspects and timeline events.
- [ ] A case is published only after required validation passes.
- [ ] A validated sample case is playable without a configured AI provider.
- [ ] The player can review evidence and see which items have been viewed.
- [ ] Hints work and the limit is enforced on the server.
- [ ] Correct and incorrect accusations both produce the expected results.
- [ ] The final accusation cannot be changed by repeating or manipulating requests.
- [ ] The reveal explains the solution using evidence the player could access.

### Security and data integrity

- [ ] The public case API never returns the hidden culprit or solution before reveal.
- [ ] The solution is not embedded in frontend source, HTML, initial state, or public metadata.
- [ ] Session ownership is checked for all session-specific operations.
- [ ] Cross-case suspect/evidence IDs are rejected.
- [ ] Provider keys are not present in frontend assets or logs.
- [ ] AI output is validated and never executed as code.
- [ ] Rate limits and request-size limits are active.
- [ ] Errors do not leak stack traces or secrets.

### Engineering quality

- [ ] Unit and integration tests cover the game engine and security-critical behavior.
- [ ] End-to-end tests cover sample case, accusation, reveal, and generation failure.
- [ ] Type checking and production builds pass.
- [ ] Loading, empty, failure, and retry states are implemented.
- [ ] The app works on desktop and mobile layouts.
- [ ] README and `.env.example` match the actual implementation.
- [ ] Known limitations are documented honestly.

---

## 19. Instructions for OpenCode

Use the following as the project-level implementation directive:

> You are the lead engineer for AI Mystery Room. `SPEC.md` is the authoritative single source of truth.
>
> Before writing code:
> 1. Read `SPEC.md` completely.
> 2. Inspect the repository, current branches, package scripts, and existing architecture.
> 3. Report gaps between the repository and the specification.
> 4. Propose a phased implementation plan with files/modules likely to change.
> 5. Identify ambiguous or consequential decisions rather than inventing requirements.
>
> Implementation rules:
> - Follow the specified functional requirements, data contracts, security constraints, and acceptance criteria.
> - Build and test a deterministic sample-case game loop before adding AI generation.
> - Keep business logic and solution evaluation on the backend.
> - Treat OpenCode as a coding agent, not as the website's runtime inference API.
> - Implement runtime AI and media integrations behind provider interfaces.
> - Validate AI-generated output before persistence or publication.
> - Never expose the canonical culprit or hidden solution before the reveal is authorized.
> - Never trust client-supplied score, correctness, or completion state.
> - Do not introduce fake functionality, unnecessary dependencies, unrelated redesigns, or unsupported claims.
> - Add tests with each meaningful feature and run them before claiming completion.
> - If a requirement is ambiguous, state the ambiguity and propose a decision.
> - If an approved decision changes scope or behavior, update `SPEC.md` and relevant tests in the same change.
>
> After each phase, report:
> - Requirements completed.
> - Files created or modified.
> - Commands/tests run and their actual results.
> - Known limitations or failures.
> - The next proposed phase.
>
> Do not claim a feature works unless it has been implemented and verified.

---

## 20. Decision log

Record meaningful decisions here so contributors and coding agents do not silently change direction.

| Date | Decision | Reason | Approved by |
|---|---|---|---|
| 2026-10-25 | Use a modular MERN application with TypeScript | Maintainability and clear frontend/backend contracts | Initial assumption |
| 2026-10-25 | Build deterministic gameplay before live AI integration | Keeps core gameplay testable and independent of provider failures | Initial assumption |
| 2026-10-25 | Treat runtime AI and media as provider adapters | Avoids coupling product logic to one vendor | Initial assumption |

Add new rows when decisions are approved. Replace “Initial assumption” with the actual approver when confirmed.

---

## 21. Change management

A specification change should include:
1. What requirement or assumption is changing.
2. Why the change is needed.
3. The impact on UI, API, data model, security, cost, and tests.
4. The approved replacement behavior.
5. Updates to this document and the corresponding implementation/tests.

Do not allow code comments, prompts, or undocumented implementation choices to silently override this file.

**End of specification.**
