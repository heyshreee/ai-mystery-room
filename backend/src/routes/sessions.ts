import { Router, type RequestHandler } from "express";
import {
  accusationRequestSchema,
  createSessionRequestSchema,
  hintRequestSchema,
  objectIdSchema,
  progressRequestSchema,
} from "@amr/shared";
import type { AppConfig } from "../config/env.js";
import type { SessionService } from "../services/session-service.js";
import {
  getRequestContext,
  setSessionCookie,
} from "../middleware/identity.js";
import { parseOrThrow } from "../utils/validation.js";

export interface SessionRouteDependencies {
  config: AppConfig;
  sessionService: SessionService;
  hintRateLimiter: RequestHandler;
}

export function createSessionRouter({
  config,
  sessionService,
  hintRateLimiter,
}: SessionRouteDependencies): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.post("/", async (req, res) => {
    const body = parseOrThrow(createSessionRequestSchema, req.body);
    const { guestHash } = getRequestContext(res);
    const created = await sessionService.createSession(body.caseId, guestHash);
    setSessionCookie(res, config, created.session.id, created.sessionToken);
    res.status(201).json({ data: created.session });
  });

  router.get("/:sessionId", async (req, res) => {
    const sessionId = parseOrThrow(objectIdSchema, req.params.sessionId);
    const { sessionCredential } = getRequestContext(res);
    const session = await sessionService.getSession(sessionId, sessionCredential);
    res.json({ data: session });
  });

  router.patch("/:sessionId/progress", async (req, res) => {
    const sessionId = parseOrThrow(objectIdSchema, req.params.sessionId);
    const body = parseOrThrow(progressRequestSchema, req.body);
    const { sessionCredential } = getRequestContext(res);
    const session = await sessionService.recordViewedEvidence(
      sessionId,
      sessionCredential,
      body.viewedEvidenceId,
    );
    res.json({ data: session });
  });

  router.post("/:sessionId/hints", hintRateLimiter, async (req, res) => {
    const sessionId = parseOrThrow(objectIdSchema, req.params.sessionId);
    parseOrThrow(hintRequestSchema, req.body ?? {});
    const { sessionCredential } = getRequestContext(res);
    const hint = await sessionService.requestHint(sessionId, sessionCredential);
    res.json({ data: hint });
  });

  router.post("/:sessionId/accusations", async (req, res) => {
    const sessionId = parseOrThrow(objectIdSchema, req.params.sessionId);
    const body = parseOrThrow(accusationRequestSchema, req.body);
    const { sessionCredential } = getRequestContext(res);
    const result = await sessionService.submitAccusation(
      sessionId,
      sessionCredential,
      body.suspectId,
    );
    res.status(201).json({ data: result });
  });

  router.get("/:sessionId/results", async (req, res) => {
    const sessionId = parseOrThrow(objectIdSchema, req.params.sessionId);
    const { sessionCredential } = getRequestContext(res);
    const result = await sessionService.getResults(sessionId, sessionCredential);
    res.json({ data: result });
  });

  return router;
}
