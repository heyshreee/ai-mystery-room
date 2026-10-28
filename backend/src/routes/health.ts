import { Router } from "express";
import type { HealthView } from "@amr/shared";
import type { AppConfig } from "../config/env.js";
import { isDatabaseConnected } from "../db/connect.js";
import { pingDatabase } from "../db/database.js";

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    let connected = isDatabaseConnected();
    if (connected) {
      try {
        await pingDatabase();
      } catch {
        connected = false;
      }
    }

    const health: HealthView = {
      status: connected ? "ok" : "degraded",
      service: "ai-mystery-room-api",
      version: config.version,
      database: connected ? "connected" : "disconnected",
      aiProvider: config.aiProvider,
      mediaProvider: config.mediaProvider,
      timestamp: new Date().toISOString(),
    };
    res.setHeader("Cache-Control", "no-store");
    res.status(connected ? 200 : 503).json({ data: health });
  });

  return router;
}
