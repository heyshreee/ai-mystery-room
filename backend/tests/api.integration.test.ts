import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/utils/logger.js";
import { CaseModel } from "../src/models/Case.js";
import { EvidenceModel } from "../src/models/Evidence.js";
import { GameSessionModel } from "../src/models/GameSession.js";
import { GenerationJobModel } from "../src/models/GenerationJob.js";
import { SolutionModel } from "../src/models/Solution.js";
import { SuspectModel } from "../src/models/Suspect.js";
import { SAMPLE_CASE_DEFINITION } from "../src/services/sample-case.js";
import { recoverInterruptedGenerations } from "../src/services/generation-recovery.js";
import { buildMockBlueprint } from "../src/generation/mock-blueprint.js";
import {
  ProviderError,
  type AIProvider,
  type StructuredGenerationInput,
} from "../src/generation/types.js";

type Agent = ReturnType<typeof request.agent>;

let mongo: MongoMemoryServer;
let app: Express;

const CULPRIT_NAME = "Jonah Reed";
const INNOCENT_NAME = "Felix Dorn";
const CUSTOM_SCENARIO =
  "A signed first edition vanishes from a locked rare-books room during a private reading. Three collectors were inside; one had already tried to buy it twice.";
const CUSTOM_BRIEF = {
  scenario: CUSTOM_SCENARIO,
  category: "theft",
  difficulty: "medium",
  evidencePreferences: ["chat_transcript", "cctv_transcript", "suspect_statement"],
} as const;

function configFor(overrides: Record<string, string> = {}) {
  return loadConfig({
    ...process.env,
    NODE_ENV: "test",
    MONGODB_URI: mongo.getUri("amr_test"),
    SESSION_SECRET: process.env.SESSION_SECRET,
    FRONTEND_ORIGIN: "http://localhost:5173,https://example.test",
    LOG_LEVEL: "silent",
    API_RATE_LIMIT_MAX: "5000",
    CASE_GENERATION_LIMIT_PER_HOUR: "500",
    HINT_RATE_LIMIT_PER_HOUR: "500",
    ...overrides,
  });
}

function makeApp(
  overrides: Record<string, string> = {},
  options: { aiProvider?: AIProvider } = {},
): Express {
  return createApp({
    config: configFor(overrides),
    logger: createLogger("silent"),
    ...(options.aiProvider ? { aiProvider: options.aiProvider } : {}),
  });
}

async function waitForGeneration(target: Express = app): Promise<void> {
  await (
    target.locals.generationService as {
      waitForIdle: () => Promise<void>;
    }
  ).waitForIdle();
}

async function readyGeneration(
  agent: Agent,
  generationId: string,
  target: Express = app,
) {
  await waitForGeneration(target);
  const response = await agent.get(`/api/generation/${generationId}`).expect(200);
  return response.body.data as {
    id: string;
    caseId: string;
    status: string;
    stage: string;
    provider: string;
    message?: string;
    errorCode?: string;
    completedAt?: string;
  };
}

async function createSample(agent: Agent, idempotencyKey?: string) {
  const req = agent.post("/api/cases").send({ sample: true });
  if (idempotencyKey) {
    req.set("Idempotency-Key", idempotencyKey);
  }
  const response = await req.expect(201);
  return response.body.data as {
    case: {
      id: string;
      suspects: Array<{ id: string; displayName: string }>;
      timeline: Array<{ eventId: string }>;
      evidenceCount: number;
      [key: string]: unknown;
    };
    generationId: string;
    sample: boolean;
  };
}

async function createSession(agent: Agent, caseId: string) {
  const response = await agent.post("/api/sessions").send({ caseId }).expect(201);
  return response.body.data as {
    id: string;
    caseId: string;
    status: string;
    hintsUsed: number;
    hintLimit: number;
    viewedEvidenceIds: string[];
    resultsAvailable: boolean;
    [key: string]: unknown;
  };
}

async function listEvidence(agent: Agent, caseId: string) {
  const response = await agent.get(`/api/cases/${caseId}/evidence`).expect(200);
  return response.body.data.evidence as Array<{
    id: string;
    exhibitNumber: number;
    title: string;
    type: string;
    [key: string]: unknown;
  }>;
}

function getSetCookies(response: {
  headers: Record<string, string | string[] | undefined>;
}): string[] {
  const header = response.headers["set-cookie"];
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) {
      keysOf(entry, found);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysOf(child, found);
    }
  }
  return found;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({
    binary: { version: "8.0.4" },
  });
  await mongoose.connect(mongo.getUri("amr_test"));
  await Promise.all([
    CaseModel.init(),
    SuspectModel.init(),
    EvidenceModel.init(),
    SolutionModel.init(),
    GameSessionModel.init(),
    GenerationJobModel.init(),
  ]);
  app = makeApp();
}, 180_000);

afterEach(async () => {
  await waitForGeneration().catch(() => undefined);
  await Promise.all([
    CaseModel.deleteMany({}).exec(),
    SuspectModel.deleteMany({}).exec(),
    EvidenceModel.deleteMany({}).exec(),
    SolutionModel.deleteMany({}).exec(),
    GameSessionModel.deleteMany({}).exec(),
    GenerationJobModel.deleteMany({}).exec(),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo.stop();
});

describe("health and foundation middleware", () => {
  it("reports readiness without leaking secrets", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.data).toMatchObject({
      status: "ok",
      service: "ai-mystery-room-api",
      database: "connected",
      aiProvider: "mock",
      mediaProvider: "static",
    });
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(JSON.stringify(response.body)).not.toContain(process.env.SESSION_SECRET);
  });

  it("applies a request ID to errors", async () => {
    const response = await request(app).get("/api/does-not-exist").expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("rejects mutations from an unapproved origin", async () => {
    const response = await request(app)
      .post("/api/cases")
      .set("Origin", "https://attacker.example")
      .send({ sample: true })
      .expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an explicitly configured frontend origin", async () => {
    const response = await request(app)
      .post("/api/cases")
      .set("Origin", "https://example.test")
      .send({ sample: true })
      .expect(201);
    expect(response.headers["access-control-allow-origin"]).toBe("https://example.test");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.body.data.case.isSample).toBe(true);
  });

  it("returns validation errors for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/cases")
      .set("Content-Type", "application/json")
      .send('{"sample": true')
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.requestId).toBeDefined();
  });

  it("enforces the request body size limit", async () => {
    const response = await request(app)
      .post("/api/cases")
      .send({ sample: true, padding: "x".repeat(40_000) })
      .expect(413);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("sample case creation and public DTO isolation", () => {
  it("creates a playable sample case without exposing solution fields", async () => {
    const agent = request.agent(app);
    const response = await agent.post("/api/cases").send({ sample: true }).expect(201);
    const data = response.body.data;
    const caseView = data.case;

    expect(data.sample).toBe(true);
    expect(data.generationId).toMatch(/^[a-f0-9]{24}$/);
    expect(caseView.suspects).toHaveLength(4);
    expect(caseView.evidenceCount).toBe(SAMPLE_CASE_DEFINITION.evidence.length);
    expect(caseView.timeline.length).toBeGreaterThanOrEqual(8);
    expect(caseView.fictionNotice).toContain("fiction");
    expect(response.headers.location).toBe(`/api/cases/${caseView.id}`);

    const allKeys = keysOf(response.body);
    const forbiddenKeys = [
      "culprit",
      "culpritSuspectId",
      "explanation",
      "hintTexts",
      "supportingEvidenceIds",
      "canonicalTimeline",
      "motive",
      "method",
      "creatorSessionId",
      "scenario",
      "guestTokenHash",
      "validationStatus",
    ].filter((key) => allKeys.has(key));
    expect(forbiddenKeys).toEqual([]);

    expect(getSetCookies(response).some((cookie) => cookie.startsWith("amr_guest="))).toBe(
      true,
    );

    const generation = await agent.get(`/api/generation/${data.generationId}`).expect(200);
    expect(generation.body.data).toMatchObject({
      status: "ready",
      provider: "mock",
      caseId: caseView.id,
    });

    const caseAgain = await agent.get(`/api/cases/${caseView.id}`).expect(200);
    expect(caseAgain.body.data.id).toBe(caseView.id);
    expect(keysOf(caseAgain.body).has("culpritSuspectId")).toBe(false);
  });

  it("makes sample creation idempotent for a repeated key", async () => {
    const agent = request.agent(app);
    const first = await createSample(agent, "preview-request-0001");
    const secondResponse = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "preview-request-0001")
      .send({ sample: true })
      .expect(200);
    expect(secondResponse.body.data.case.id).toBe(first.case.id);
    expect(secondResponse.body.data.generationId).toBe(first.generationId);
    expect(await CaseModel.countDocuments({})).toBe(1);
  });

  it("keeps the sample case public but honors private case ownership", async () => {
    const owner = request.agent(app);
    const created = await createSample(owner);
    await owner.get(`/api/cases/${created.case.id}`).expect(200);

    await CaseModel.updateOne(
      { _id: created.case.id },
      { $set: { isPublic: false } },
    ).exec();

    const stranger = request.agent(app);
    const response = await stranger.get(`/api/cases/${created.case.id}`).expect(404);
    expect(response.body.error.code).toBe("CASE_NOT_FOUND");
    await stranger
      .post("/api/sessions")
      .send({ caseId: created.case.id })
      .expect(404);

    await owner.get(`/api/cases/${created.case.id}`).expect(200);
  });

  it("returns field-level errors for invalid scenarios", async () => {
    const response = await request(app)
      .post("/api/cases")
      .send({
        scenario: "Too short.",
        category: "theft",
        difficulty: "medium",
        evidencePreferences: ["chat_transcript"],
      })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "scenario" }),
      ]),
    );
  });

  it("keeps the sample playable even when a live provider is failing", async () => {
    const failingProvider: AIProvider = {
      id: "mock",
      async generateStructured() {
        throw new ProviderError(
          "AI_PROVIDER_UNAVAILABLE",
          "Provider is intentionally offline for the test.",
          { retryable: false },
        );
      },
    };
    const sampleApp = makeApp({}, { aiProvider: failingProvider });
    const agent = request.agent(sampleApp);
    const created = await createSample(agent);
    expect(created.sample).toBe(true);
    await agent.get(`/api/cases/${created.case.id}`).expect(200);
  });
});

describe("custom generation pipeline", () => {
  it("accepts a brief asynchronously and publishes a validated mock case", async () => {
    const agent = request.agent(app);
    const response = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-success-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);
    const accepted = response.body.data;

    expect(["pending", "validating", "ready"]).toContain(accepted.status);
    expect(accepted.id).toMatch(/^[a-f0-9]{24}$/);
    expect(accepted.caseId).toMatch(/^[a-f0-9]{24}$/);
    expect(accepted.provider).toBe("mock");
    expect(response.headers.location).toBe(`/api/generation/${accepted.id}`);
    expect(JSON.stringify(response.body)).not.toContain("culprit");
    expect(JSON.stringify(response.body)).not.toContain("solution");

    const finished = await readyGeneration(agent, accepted.id);
    expect(finished).toMatchObject({
      status: "ready",
      stage: "published",
      provider: "mock",
    });
    expect(finished.message).toContain("ready");
    expect(finished.completedAt).toBeTruthy();

    const caseResponse = await agent.get(`/api/cases/${finished.caseId}`).expect(200);
    const caseView = caseResponse.body.data;
    expect(caseView).toMatchObject({
      id: finished.caseId,
      status: "ready",
      isSample: false,
      difficulty: "medium",
      category: "theft",
    });
    expect(caseView.suspects).toHaveLength(4);
    expect(caseView.timeline).toHaveLength(11);
    expect(caseView.evidenceCount).toBeGreaterThanOrEqual(6);
    expect(caseView.fictionNotice).toContain("fiction");

    const forbiddenKeys = [
      "culprit",
      "culpritSuspectId",
      "explanation",
      "hintTexts",
      "supportingEvidenceIds",
      "canonicalTimeline",
      "motive",
      "method",
      "creatorSessionId",
      "scenario",
      "guestTokenHash",
      "validationStatus",
    ].filter((key) => keysOf(caseResponse.body).has(key));
    expect(forbiddenKeys).toEqual([]);

    const evidence = await listEvidence(agent, finished.caseId);
    expect(evidence.length).toBeGreaterThanOrEqual(6);
    expect(evidence.every((item) => !("content" in item))).toBe(true);
    const image = evidence.find((item) => item.type === "image");
    expect(image).toBeTruthy();
    expect(image?.mediaStatus).toBe("ready");
    expect(image?.mediaUrl).toBe("/case-assets/evidence-map.svg");

    if (!image) {
      throw new Error("generated case is missing an image exhibit");
    }
    const imageDetail = await agent.get(`/api/evidence/${image.id}`).expect(200);
    expect(imageDetail.body.data.content).toMatchObject({
      format: "image",
      imageUrl: "/case-assets/evidence-map.svg",
      simulated: true,
    });
    expect(imageDetail.body.data.sourceLabel).toContain("static fictional diagram");

    const solution = await SolutionModel.findOne({ caseId: finished.caseId }).exec();
    expect(solution).toBeTruthy();
    expect(solution?.validationStatus).toBe("valid");
    if (!solution) {
      throw new Error("generated case is missing its solution");
    }
    expect(caseView.suspects.map((suspect: { id: string }) => suspect.id)).toContain(
      solution.culpritSuspectId.toString(),
    );

    const job = await GenerationJobModel.findById(finished.id).exec();
    expect(job?.attempts).toBeGreaterThanOrEqual(1);
    expect(job?.promptVersion).toBe("case-blueprint-v1");

    const session = await createSession(agent, finished.caseId);
    const result = await agent
      .post(`/api/sessions/${session.id}/accusations`)
      .send({ suspectId: solution.culpritSuspectId.toString() })
      .expect(201);
    expect(result.body.data.correct).toBe(true);
    expect(result.body.data.solution.explanation).toContain("Supporting exhibits:");
  });

  it("replays a completed custom request with the same idempotency key", async () => {
    const agent = request.agent(app);
    const first = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-idempotent-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);
    const finished = await readyGeneration(agent, first.body.data.id);

    const replay = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-idempotent-0001")
      .send(CUSTOM_BRIEF)
      .expect(200);
    expect(replay.body.data.case.id).toBe(finished.caseId);
    expect(replay.body.data.generationId).toBe(finished.id);
    expect(await CaseModel.countDocuments({ isSample: false })).toBe(1);
  });

  it("shares one in-flight generation for duplicate submissions", async () => {
    const provider = new BlockingProvider();
    const gatedApp = makeApp({}, { aiProvider: provider });
    const agent = request.agent(gatedApp);

    const first = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-inflight-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);
    await provider.started;

    const duplicate = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-inflight-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);
    expect(duplicate.body.data.id).toBe(first.body.data.id);
    expect(duplicate.body.data.caseId).toBe(first.body.data.caseId);
    expect(await CaseModel.countDocuments({ isSample: false })).toBe(1);

    provider.release();
    const finished = await readyGeneration(agent, first.body.data.id, gatedApp);
    expect(finished.status).toBe("ready");

    const after = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-inflight-0001")
      .send(CUSTOM_BRIEF)
      .expect(200);
    expect(after.body.data.case.id).toBe(first.body.data.caseId);
  });

  it("rejects an invalid blueprint, retries, and publishes nothing", async () => {
    const invalidProvider: AIProvider = {
      id: "mock",
      async generateStructured() {
        return { title: "Incomplete case" };
      },
    };
    const failingApp = makeApp(
      { MAX_GENERATION_ATTEMPTS: "2" },
      { aiProvider: invalidProvider },
    );
    const agent = request.agent(failingApp);
    const accepted = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-invalid-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);

    const status = await readyGeneration(agent, accepted.body.data.id, failingApp);
    expect(status).toMatchObject({
      status: "failed",
      stage: "failed",
      errorCode: "INVALID_AI_OUTPUT",
    });
    expect(status.message).toContain("validation");

    const caseResponse = await agent.get(`/api/cases/${status.caseId}`).expect(409);
    expect(caseResponse.body.error.code).toBe("CASE_NOT_READY");

    const job = await GenerationJobModel.findById(status.id).exec();
    expect(job?.attempts).toBe(2);
    expect(await SuspectModel.countDocuments({ caseId: status.caseId })).toBe(0);
    expect(await EvidenceModel.countDocuments({ caseId: status.caseId })).toBe(0);
    expect(await SolutionModel.countDocuments({ caseId: status.caseId })).toBe(0);
    const failedCase = await CaseModel.findById(status.caseId).exec();
    expect(failedCase?.status).toBe("failed");
  });

  it("does not publish a schema-valid case that names the culprit publicly", async () => {
    const leakingProvider: AIProvider = {
      id: "mock",
      async generateStructured(input) {
        const blueprint = buildMockBlueprint(requireContext(input));
        const culprit = blueprint.suspects.find(
          (suspect) => suspect.key === blueprint.culpritKey,
        );
        if (!culprit) {
          throw new Error("mock blueprint is missing its culprit");
        }
        return {
          ...blueprint,
          publicTimeline: blueprint.publicTimeline.map((event, index) =>
            index === 0
              ? {
                  ...event,
                  description: `${culprit.displayName} was seen near the room before the incident.`,
                }
              : event,
          ),
        };
      },
    };
    const failingApp = makeApp(
      { MAX_GENERATION_ATTEMPTS: "1" },
      { aiProvider: leakingProvider },
    );
    const agent = request.agent(failingApp);
    const accepted = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-leak-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);

    const status = await readyGeneration(agent, accepted.body.data.id, failingApp);
    expect(status).toMatchObject({
      status: "failed",
      errorCode: "INVALID_AI_OUTPUT",
    });
    expect(await SuspectModel.countDocuments({ caseId: status.caseId })).toBe(0);
    expect(await EvidenceModel.countDocuments({ caseId: status.caseId })).toBe(0);
    expect(await SolutionModel.countDocuments({ caseId: status.caseId })).toBe(0);
  });

  it("bounds timeout retries and reports a safe category", async () => {
    let calls = 0;
    const timeoutProvider: AIProvider = {
      id: "mock",
      async generateStructured() {
        calls += 1;
        throw new ProviderError(
          "GENERATION_TIMEOUT",
          "Test provider timed out.",
          { retryable: true },
        );
      },
    };
    const failingApp = makeApp(
      { MAX_GENERATION_ATTEMPTS: "2" },
      { aiProvider: timeoutProvider },
    );
    const agent = request.agent(failingApp);
    const accepted = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-timeout-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);

    const status = await readyGeneration(agent, accepted.body.data.id, failingApp);
    expect(status).toMatchObject({
      status: "failed",
      errorCode: "GENERATION_TIMEOUT",
    });
    expect(status.message).toContain("timeout");
    expect(calls).toBe(2);
    expect(await CaseModel.countDocuments({ isSample: false })).toBe(1);
  });

  it("does not retry a provider that rejects its credentials", async () => {
    let calls = 0;
    const unavailableProvider: AIProvider = {
      id: "mock",
      async generateStructured() {
        calls += 1;
        throw new ProviderError(
          "AI_PROVIDER_UNAVAILABLE",
          "Test provider rejected credentials.",
          { retryable: false },
        );
      },
    };
    const failingApp = makeApp(
      { MAX_GENERATION_ATTEMPTS: "3" },
      { aiProvider: unavailableProvider },
    );
    const agent = request.agent(failingApp);
    const accepted = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-unavailable-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);

    const status = await readyGeneration(agent, accepted.body.data.id, failingApp);
    expect(status).toMatchObject({
      status: "failed",
      errorCode: "AI_PROVIDER_UNAVAILABLE",
    });
    expect(status.message).toContain("sample");
    expect(calls).toBe(1);
  });

  it("retries a blueprint validation failure once before publishing", async () => {
    let calls = 0;
    const flakyProvider: AIProvider = {
      id: "mock",
      async generateStructured(input) {
        calls += 1;
        if (calls === 1) {
          return { title: "Incomplete case" };
        }
        return buildMockBlueprint(requireContext(input));
      },
    };
    const retryingApp = makeApp(
      { MAX_GENERATION_ATTEMPTS: "3" },
      { aiProvider: flakyProvider },
    );
    const agent = request.agent(retryingApp);
    const accepted = await agent
      .post("/api/cases")
      .set("Idempotency-Key", "custom-flaky-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);

    const status = await readyGeneration(agent, accepted.body.data.id, retryingApp);
    expect(status.status).toBe("ready");
    expect(calls).toBe(2);
    const job = await GenerationJobModel.findById(status.id).exec();
    expect(job?.attempts).toBe(2);
  });

  it("hides a custom case and its generation status from another guest", async () => {
    const owner = request.agent(app);
    const stranger = request.agent(app);
    const first = await owner
      .post("/api/cases")
      .set("Idempotency-Key", "custom-private-0001")
      .send(CUSTOM_BRIEF)
      .expect(202);
    const finished = await readyGeneration(owner, first.body.data.id);

    await stranger.get(`/api/cases/${finished.caseId}`).expect(404);
    await stranger.get(`/api/generation/${finished.id}`).expect(404);
    await owner.get(`/api/cases/${finished.caseId}`).expect(200);
    await owner.get(`/api/generation/${finished.id}`).expect(200);
  });

  it("marks an interrupted generation as failed on the next startup", async () => {
    const caseId = new mongoose.Types.ObjectId();
    const generationId = new mongoose.Types.ObjectId();

    await CaseModel.create({
      _id: caseId,
      title: "Interrupted case",
      scenario: CUSTOM_SCENARIO,
      summary: "A generation that was interrupted by a restart.",
      category: "theft",
      difficulty: "medium",
      status: "generating",
      creatorSessionId: "interrupted-guest-hash",
      suspectIds: [],
      evidenceIds: [],
      generationVersion: "mock:case-blueprint-v1",
      generationId,
      isSample: false,
      isPublic: false,
      incident: {
        location: "Pending generation",
        occurredAt: new Date().toISOString(),
        description: "Pending generation",
      },
      timezone: "UTC",
      caseRules: [],
      fictionNotice: "This case is fictional.",
      timeline: [],
    });
    await GenerationJobModel.create({
      _id: generationId,
      caseId,
      creatorSessionId: "interrupted-guest-hash",
      status: "pending",
      stage: "drafting_blueprint",
      attempts: 1,
      provider: "mock",
      promptVersion: "case-blueprint-v1",
      message: "Drafting the case blueprint.",
    });
    await SuspectModel.create({
      caseId,
      displayName: "Interrupted Suspect",
      role: "Role",
      profile: "Partial profile",
      motiveSummary: "Partial motive",
      opportunitySummary: "Partial opportunity",
      publicStatement: "Partial statement",
      relationships: [],
    });

    const result = await recoverInterruptedGenerations(createLogger("silent"));
    expect(result).toEqual({ cases: 1, jobs: 1 });

    const failedCase = await CaseModel.findById(caseId).exec();
    expect(failedCase?.status).toBe("failed");
    const failedJob = await GenerationJobModel.findById(generationId).exec();
    expect(failedJob).toMatchObject({
      status: "failed",
      stage: "failed",
      errorCode: "GENERATION_FAILED",
    });
    expect(failedJob?.message).toContain("restarted");
    expect(await SuspectModel.countDocuments({ caseId })).toBe(0);
    expect(await EvidenceModel.countDocuments({ caseId })).toBe(0);
    expect(await SolutionModel.countDocuments({ caseId })).toBe(0);

    await expect(recoverInterruptedGenerations(createLogger("silent"))).resolves.toEqual({
      cases: 0,
      jobs: 0,
    });
  });
});

class BlockingProvider implements AIProvider {
  readonly id = "mock";
  private releaseGate!: () => void;
  private markStarted!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });
  private readonly gate = new Promise<void>((resolve) => {
    this.releaseGate = resolve;
  });

  async generateStructured(input: StructuredGenerationInput): Promise<unknown> {
    this.markStarted();
    await this.gate;
    return buildMockBlueprint(requireContext(input));
  }

  release(): void {
    this.releaseGate();
  }
}

function requireContext(input: StructuredGenerationInput) {
  if (!input.context) {
    throw new Error("Test provider requires normalized generation context.");
  }
  return input.context;
}

describe("investigation, hints, accusation, and reveal", () => {
  it("runs the correct-accusation path with server-side scoring", async () => {
    const agent = request.agent(app);
    const created = await createSample(agent);
    const caseId = created.case.id;
    const evidence = await listEvidence(agent, caseId);
    expect(evidence).toHaveLength(8);
    expect(evidence[0]).not.toHaveProperty("content");

    const firstEvidence = evidence[0];
    if (!firstEvidence) {
      throw new Error("sample case has no evidence");
    }
    const detail = await agent.get(`/api/evidence/${firstEvidence.id}`).expect(200);
    expect(detail.body.data.content).toBeDefined();
    expect(detail.body.data.fictionNotice).toContain("fiction");

    const createSessionResponse = await agent
      .post("/api/sessions")
      .send({ caseId })
      .expect(201);
    const session = createSessionResponse.body.data;
    expect(session).not.toHaveProperty("score");
    const cookie = getSetCookies(createSessionResponse).find((entry) =>
      entry.startsWith("amr_session="),
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api");
    expect(JSON.stringify(createSessionResponse.body)).not.toContain("amr_session");

    const before = await agent.get(`/api/sessions/${session.id}/results`).expect(409);
    expect(before.body.error.code).toBe("RESULT_NOT_AVAILABLE");
    expect(JSON.stringify(before.body)).not.toContain("Jonah");

    const viewed = await agent
      .patch(`/api/sessions/${session.id}/progress`)
      .send({ viewedEvidenceId: firstEvidence.id })
      .expect(200);
    expect(viewed.body.data.viewedEvidenceIds).toContain(firstEvidence.id);

    await agent
      .patch(`/api/sessions/${session.id}/progress`)
      .send({ viewedEvidenceId: firstEvidence.id })
      .expect(200);
    const sessionWithView = await agent.get(`/api/sessions/${session.id}`).expect(200);
    expect(sessionWithView.body.data.viewedEvidenceIds).toEqual([firstEvidence.id]);

    const firstHint = await agent
      .post(`/api/sessions/${session.id}/hints`)
      .send({})
      .expect(200);
    expect(firstHint.body.data.hintsUsed).toBe(1);
    expect(firstHint.body.data.hintsRemaining).toBe(2);
    await agent.post(`/api/sessions/${session.id}/hints`).send({}).expect(200);
    await agent.post(`/api/sessions/${session.id}/hints`).send({}).expect(200);
    const limit = await agent
      .post(`/api/sessions/${session.id}/hints`)
      .send({})
      .expect(409);
    expect(limit.body.error.code).toBe("HINT_LIMIT_REACHED");

    const tampered = await agent
      .post(`/api/sessions/${session.id}/accusations`)
      .send({
        suspectId: created.case.suspects.find((suspect) => suspect.displayName === CULPRIT_NAME)
          ?.id,
        score: 999,
      })
      .expect(400);
    expect(tampered.body.error.code).toBe("VALIDATION_ERROR");

    const culprit = created.case.suspects.find(
      (suspect) => suspect.displayName === CULPRIT_NAME,
    );
    if (!culprit) {
      throw new Error("culprit missing from sample DTO");
    }

    const result = await agent
      .post(`/api/sessions/${session.id}/accusations`)
      .send({ suspectId: culprit.id })
      .expect(201);
    expect(result.body.data.correct).toBe(true);
    expect(result.body.data.culprit.displayName).toBe(CULPRIT_NAME);
    expect(result.body.data.score).toEqual({
      base: 100,
      hintPenalty: 30,
      hintsUsed: 3,
      total: 70,
    });
    expect(result.body.data.supportingEvidence.length).toBeGreaterThanOrEqual(2);
    expect(result.body.data.solution.explanation).toContain("EXH-04");

    const repeat = await agent
      .post(`/api/sessions/${session.id}/accusations`)
      .send({ suspectId: culprit.id })
      .expect(409);
    expect(repeat.body.error.code).toBe("SESSION_COMPLETED");

    const results = await agent.get(`/api/sessions/${session.id}/results`).expect(200);
    expect(results.body.data.culprit.id).toBe(culprit.id);
    expect(results.body.data.score.total).toBe(70);

    const completedSession = await agent.get(`/api/sessions/${session.id}`).expect(200);
    expect(completedSession.body.data.status).toBe("completed");
    expect(completedSession.body.data.resultsAvailable).toBe(true);

    const progressAfterCompletion = await agent
      .patch(`/api/sessions/${session.id}/progress`)
      .send({ viewedEvidenceId: firstEvidence.id })
      .expect(409);
    expect(progressAfterCompletion.body.error.code).toBe("SESSION_COMPLETED");
  });

  it("scores an incorrect accusation at zero and still reveals the solution", async () => {
    const agent = request.agent(app);
    const created = await createSample(agent);
    const session = await createSession(agent, created.case.id);
    const innocent = created.case.suspects.find(
      (suspect) => suspect.displayName === INNOCENT_NAME,
    );
    if (!innocent) {
      throw new Error("innocent suspect missing");
    }

    const result = await agent
      .post(`/api/sessions/${session.id}/accusations`)
      .send({ suspectId: innocent.id })
      .expect(201);
    expect(result.body.data.correct).toBe(false);
    expect(result.body.data.culprit.displayName).toBe(CULPRIT_NAME);
    expect(result.body.data.score).toEqual({
      base: 0,
      hintPenalty: 0,
      hintsUsed: 0,
      total: 0,
    });
    expect(result.body.data.solution.explanation).toBeTruthy();

    const results = await agent.get(`/api/sessions/${session.id}/results`).expect(200);
    expect(results.body.data.correct).toBe(false);
  });

  it("rejects cross-case evidence, suspects, and session credentials", async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const caseA = await createSample(agentA);
    const caseB = await createSample(agentB);
    const sessionA = await createSession(agentA, caseA.case.id);
    await createSession(agentB, caseB.case.id);

    const evidenceB = await listEvidence(agentB, caseB.case.id);
    const firstEvidenceB = evidenceB[0];
    if (!firstEvidenceB) {
      throw new Error("case B has no evidence");
    }

    const crossEvidence = await agentA
      .patch(`/api/sessions/${sessionA.id}/progress`)
      .send({ viewedEvidenceId: firstEvidenceB.id })
      .expect(404);
    expect(crossEvidence.body.error.code).toBe("EVIDENCE_NOT_FOUND");

    const suspectB = caseB.case.suspects[0];
    if (!suspectB) {
      throw new Error("case B has no suspects");
    }
    const crossSuspect = await agentA
      .post(`/api/sessions/${sessionA.id}/accusations`)
      .send({ suspectId: suspectB.id })
      .expect(400);
    expect(crossSuspect.body.error.code).toBe("INVALID_ACCUSATION");

    const stolenSession = await agentB
      .get(`/api/sessions/${sessionA.id}`)
      .expect(404);
    expect(stolenSession.body.error.code).toBe("SESSION_NOT_FOUND");

    await agentB
      .patch(`/api/sessions/${sessionA.id}/progress`)
      .send({ viewedEvidenceId: firstEvidenceB.id })
      .expect(404);

    await CaseModel.updateOne(
      { _id: caseB.case.id },
      { $set: { isPublic: false } },
    ).exec();
    const evidenceAfterPrivate = await agentA
      .get(`/api/evidence/${firstEvidenceB.id}`)
      .expect(404);
    expect(evidenceAfterPrivate.body.error.code).toBe("CASE_NOT_FOUND");
  });

  it("expires sessions on the server", async () => {
    const agent = request.agent(app);
    const created = await createSample(agent);
    const session = await createSession(agent, created.case.id);

    await GameSessionModel.updateOne(
      { _id: session.id },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    ).exec();

    const evidence = await listEvidence(agent, created.case.id);
    const evidenceId = evidence[0]?.id;
    if (!evidenceId) {
      throw new Error("sample case has no evidence");
    }

    const response = await agent.get(`/api/sessions/${session.id}`).expect(410);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
    await agent.get(`/api/sessions/${session.id}/results`).expect(410);
    await agent
      .patch(`/api/sessions/${session.id}/progress`)
      .send({ viewedEvidenceId: evidenceId })
      .expect(410);
  });
});

describe("rate limiting", () => {
  it("enforces the case-generation limit per client", async () => {
    const limitedApp = makeApp({ CASE_GENERATION_LIMIT_PER_HOUR: "1" });
    const agent = request.agent(limitedApp);
    await agent.post("/api/cases").send({ sample: true }).expect(201);
    const blocked = await agent
      .post("/api/cases")
      .send({ sample: true })
      .expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});
