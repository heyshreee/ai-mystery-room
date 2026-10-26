import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import type { AppConfig } from "./config/env.js";
import { createLogger, type Logger } from "./utils/logger.js";
import { guestIdentityMiddleware } from "./middleware/identity.js";
import { requestContextMiddleware } from "./middleware/request-context.js";
import { originGuardMiddleware } from "./middleware/origin-guard.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { CaseService } from "./services/case-service.js";
import { GenerationService } from "./services/generation-service.js";
import { SessionService } from "./services/session-service.js";
import { createAIProvider } from "./generation/provider-factory.js";
import type { AIProvider } from "./generation/types.js";
import { createHealthRouter } from "./routes/health.js";
import { createCaseRouter } from "./routes/cases.js";
import { createEvidenceRouter } from "./routes/evidence.js";
import { createSessionRouter } from "./routes/sessions.js";
import { createGenerationRouter } from "./routes/generation.js";

export interface CreateAppOptions {
  config: AppConfig;
  logger?: Logger;
  /** Injectable for tests; production uses the configured provider factory. */
  aiProvider?: AIProvider;
}

export function createApp({
  config,
  logger = createLogger(config.logLevel),
  aiProvider = createAIProvider(config, logger),
}: CreateAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy ? 1 : false);
  app.set("json escape", true);

  const allowedOrigins = new Set(config.frontendOrigins);

  app.use(requestContextMiddleware(logger));
  app.use(
    helmet({
      hsts: config.isProduction,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Idempotency-Key", "X-Request-Id"],
      exposedHeaders: [
        "X-Request-Id",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
      ],
      maxAge: 600,
    }),
  );
  app.use(originGuardMiddleware(config.frontendOrigins));
  app.use(express.json({ limit: config.requestBodyLimit, strict: true }));
  app.use(cookieParser());
  app.use(guestIdentityMiddleware(config));

  const generationService = new GenerationService({
    config,
    logger,
    aiProvider,
  });
  const caseService = new CaseService({ config, logger, generationService });
  const sessionService = new SessionService({ config, logger, caseService });
  app.locals.caseService = caseService;
  app.locals.generationService = generationService;
  app.locals.aiProvider = aiProvider;

  const globalApiLimiter = createRateLimiter({
    windowMs: config.apiRateLimitWindowMs,
    max: config.apiRateLimitMax,
    keyPrefix: "api",
    message: "Too many requests. Please wait and try again.",
  });

  const generationRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: config.caseGenerationLimitPerHour,
    keyPrefix: "case-generation",
    message: "The case-generation limit has been reached. Please try again later.",
  });

  const hintRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: config.hintRateLimitPerHour,
    keyPrefix: "hint",
    message: "Too many hint requests. Please wait before asking again.",
  });

  app.use("/api/health", createHealthRouter(config));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", globalApiLimiter);
  app.use("/api/cases", createCaseRouter({ caseService, generationRateLimiter }));
  app.use("/api/evidence", createEvidenceRouter(caseService));
  app.use(
    "/api/sessions",
    createSessionRouter({ config, sessionService, hintRateLimiter }),
  );
  app.use("/api/generation", createGenerationRouter(caseService));

  app.use("/api", notFoundHandler());
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}
