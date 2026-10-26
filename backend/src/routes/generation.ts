import { Router } from "express";
import { objectIdSchema } from "@amr/shared";
import type { CaseService } from "../services/case-service.js";
import { getGuestContext } from "../middleware/identity.js";
import { parseOrThrow } from "../utils/validation.js";

export function createGenerationRouter(caseService: CaseService): Router {
  const router = Router();

  router.get("/:generationId", async (req, res) => {
    const generationId = parseOrThrow(objectIdSchema, req.params.generationId);
    const { guestHash } = getGuestContext(res);
    const generation = await caseService.getGenerationStatus(generationId, guestHash);
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: generation });
  });

  return router;
}
