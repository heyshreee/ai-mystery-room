import { Router, type RequestHandler } from "express";
import type { Response } from "express";
import {
  customCaseRequestSchema,
  idempotencyKeySchema,
  objectIdSchema,
  sampleCaseRequestSchema,
} from "@amr/shared";
import type { CaseService } from "../services/case-service.js";
import { getGuestContext } from "../middleware/identity.js";
import { parseOrThrow } from "../utils/validation.js";

export interface CaseRouteDependencies {
  caseService: CaseService;
  generationRateLimiter: RequestHandler;
}

export function createCaseRouter({
  caseService,
  generationRateLimiter,
}: CaseRouteDependencies): Router {
  const router = Router();

  router.post("/", generationRateLimiter, async (req, res) => {
    const idempotencyHeader = req.get("Idempotency-Key");
    const idempotencyKey = idempotencyHeader
      ? parseOrThrow(idempotencyKeySchema, idempotencyHeader)
      : undefined;

    if (typeof req.body === "object" && req.body !== null && req.body.sample === true) {
      parseOrThrow(sampleCaseRequestSchema, req.body);
      const { guestHash } = getGuestContext(res);
      const result = await caseService.createSampleCase(guestHash, idempotencyKey);
      res.status(result.created ? 201 : 200);
      res.setHeader("Location", `/api/cases/${result.data.case.id}`);
      cacheNoStore(res);
      res.json({ data: result.data });
      return;
    }

    const request = parseOrThrow(customCaseRequestSchema, req.body);
    const { guestHash } = getGuestContext(res);
    const result = await caseService.createCustomCase(
      request,
      guestHash,
      idempotencyKey,
    );
    cacheNoStore(res);

    if (result.kind === "accepted") {
      res.status(202);
      res.setHeader("Location", `/api/generation/${result.generation.id}`);
      res.json({ data: result.generation });
      return;
    }

    res.status(result.created ? 201 : 200);
    res.setHeader("Location", `/api/cases/${result.data.case.id}`);
    res.json({ data: result.data });
  });

  router.get("/:caseId", async (req, res) => {
    const caseId = parseOrThrow(objectIdSchema, req.params.caseId);
    const { guestHash } = getGuestContext(res);
    const caseView = await caseService.getPublicCase(caseId, guestHash);
    cacheNoStore(res);
    res.json({ data: caseView });
  });

  router.get("/:caseId/evidence", async (req, res) => {
    const caseId = parseOrThrow(objectIdSchema, req.params.caseId);
    const { guestHash } = getGuestContext(res);
    const evidence = await caseService.listEvidence(caseId, guestHash);
    cacheNoStore(res);
    res.json({ data: evidence });
  });

  return router;
}

function cacheNoStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
}
