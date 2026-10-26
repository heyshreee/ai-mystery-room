import { Router } from "express";
import { objectIdSchema } from "@amr/shared";
import type { CaseService } from "../services/case-service.js";
import { getGuestContext } from "../middleware/identity.js";
import { parseOrThrow } from "../utils/validation.js";

export function createEvidenceRouter(caseService: CaseService): Router {
  const router = Router();

  router.get("/:evidenceId", async (req, res) => {
    const evidenceId = parseOrThrow(objectIdSchema, req.params.evidenceId);
    const { guestHash } = getGuestContext(res);
    const evidence = await caseService.getEvidence(evidenceId, guestHash);
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: evidence });
  });

  return router;
}
