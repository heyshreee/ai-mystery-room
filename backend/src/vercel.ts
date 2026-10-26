import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express, NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { attachDatabasePool, waitUntil } from "@vercel/functions";
import { loadConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { connectDatabase } from "./db/connect.js";
import type { GenerationService } from "./services/generation-service.js";
import { createLogger, type Logger } from "./utils/logger.js";

interface Runtime {
  app: Express;
  logger: Logger;
}

let runtimePromise: Promise<Runtime> | undefined;

async function createRuntime(): Promise<Runtime> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  await connectDatabase(config, logger);

  // Keep idle MongoDB connections from pinning a suspended Fluid Compute
  // instance. The helper is optional outside Vercel and safe to skip if the
  // driver shape is not recognized.
  try {
    attachDatabasePool(mongoose.connection.getClient());
  } catch (error) {
    logger.warn({ err: error }, "could not attach the MongoDB pool to Vercel");
  }

  return { app: createApp({ config, logger }), logger };
}

async function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    runtimePromise = createRuntime().catch((error: unknown) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

/**
 * Vercel Node.js entry point for the Express API.
 *
 * The app is a normal Express instance. The catch-all function keeps the
 * single-process request model, while `waitUntil` lets the in-process
 * generation worker finish after the 202 response is sent. Generation still
 * requires a durable queue before it can be considered restart-safe.
 */
export default async function handler(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  const { app, logger } = await getRuntime();
  const request = incoming as unknown as Request;
  const response = outgoing as unknown as Response;
  const next: NextFunction = (error?: unknown) => {
    if (error) {
      logger.error({ err: error }, "unhandled Vercel request error");
      if (!response.headersSent) {
        response.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred. Please try again.",
          },
        });
      }
      return;
    }
    response.status(404).end();
  };

  const responseFinished = new Promise<void>((resolve) => {
    response.once("finish", resolve);
    response.once("close", resolve);
  });

  app(request, response, next);

  const generationService = app.locals.generationService as GenerationService;
  waitUntil(
    responseFinished
      .then(() => generationService.waitForIdle())
      .catch((error: unknown) => {
        logger.error({ err: error }, "background generation task failed");
      }),
  );
}
