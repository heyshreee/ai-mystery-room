import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express, NextFunction, Request, Response } from "express";
import { attachDatabasePool, waitUntil } from "@vercel/functions";
import { loadConfig, type AppConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { connectDatabase } from "./db/connect.js";
import { getDatabase } from "./db/database.js";
import type { GenerationService } from "./services/generation-service.js";
import { createLogger, type Logger } from "./utils/logger.js";

interface Runtime {
  app: Express;
  logger: Logger;
}

class DatabaseUnavailableError extends Error {
  constructor(
    readonly config: AppConfig,
    readonly logger: Logger,
    cause: unknown,
  ) {
    super("The database connection could not be established.", { cause });
    this.name = "DatabaseUnavailableError";
  }
}

let runtimePromise: Promise<Runtime> | undefined;

async function createRuntime(): Promise<Runtime> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  try {
    await connectDatabase(config, logger);
  } catch (error) {
    throw new DatabaseUnavailableError(config, logger, error);
  }

  // Keep idle Postgres connections from pinning a suspended Fluid Compute
  // instance. The helper is optional outside Vercel and safe to skip if the
  // pool shape is not recognized.
  try {
    const pool = getDatabase().rawPool;
    if (pool) {
      attachDatabasePool(pool);
    }
  } catch (error) {
    logger.warn({ err: error }, "could not attach the Postgres pool to Vercel");
  }

  return { app: createApp({ config, logger }), logger };
}

function writeDatabaseUnavailable(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  config: AppConfig,
): void {
  const path = (incoming.url ?? "").split("?")[0];
  outgoing.statusCode = 503;
  outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
  outgoing.setHeader("Cache-Control", "no-store");

  if (path === "/api/health") {
    outgoing.end(
      JSON.stringify({
        data: {
          status: "degraded",
          service: "ai-mystery-room-api",
          version: config.version,
          database: "disconnected",
          aiProvider: config.aiProvider,
          mediaProvider: config.mediaProvider,
          timestamp: new Date().toISOString(),
        },
      }),
    );
    return;
  }

  outgoing.end(
    JSON.stringify({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message:
          "The API is temporarily unavailable because its database connection could not be established.",
      },
    }),
  );
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
  let runtime: Runtime;
  try {
    runtime = await getRuntime();
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      error.logger.error({ err: error.cause }, "database unavailable");
      writeDatabaseUnavailable(incoming, outgoing, error.config);
      return;
    }
    throw error;
  }

  const { app, logger } = runtime;
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
