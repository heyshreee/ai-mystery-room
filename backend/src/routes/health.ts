import { Router } from "express";
import mongoose from "mongoose";
import type { HealthView } from "@amr/shared";
import type { AppConfig } from "../config/env.js";

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
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
