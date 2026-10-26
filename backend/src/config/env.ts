import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(moduleDirectory, "../../..");
dotenv.config({ path: resolve(projectRoot, ".env"), quiet: true });

const railwayBoolean = z
  .enum(["0", "1", "true", "false"])
  .transform((value) => value === "1" || value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required."),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters.")
    .refine(
      (value) => !value.includes("replace_with"),
      "SESSION_SECRET still contains the example placeholder.",
    ),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  GUEST_COOKIE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRUST_PROXY: railwayBoolean.default(false),
  CASE_GENERATION_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(5),
  HINT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(30),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  MAX_SCENARIO_LENGTH: z.coerce.number().int().min(30).max(10_000).default(2000),
  MAX_GENERATION_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  HINT_LIMIT: z.coerce.number().int().min(1).max(10).default(3),
  REQUEST_BODY_LIMIT: z.string().min(1).default("32kb"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  AI_PROVIDER: z.enum(["mock", "openai-compatible"]).default("mock"),
  AI_BASE_URL: z.string().trim().default(""),
  AI_API_KEY: z.string().trim().default(""),
  AI_MODEL: z.string().trim().default(""),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(100_000).default(8_000),
  MEDIA_PROVIDER: z.enum(["none", "static"]).default("static"),
}).superRefine((environment, context) => {
  if (environment.AI_BASE_URL && !/^https?:\/\//i.test(environment.AI_BASE_URL)) {
    context.addIssue({
      code: "custom",
      path: ["AI_BASE_URL"],
      message: "AI_BASE_URL must be an http:// or https:// URL.",
    });
  }

  if (environment.AI_PROVIDER === "openai-compatible") {
    if (!environment.AI_BASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["AI_BASE_URL"],
        message: "AI_BASE_URL is required when AI_PROVIDER=openai-compatible.",
      });
    }
    if (!environment.AI_MODEL) {
      context.addIssue({
        code: "custom",
        path: ["AI_MODEL"],
        message: "AI_MODEL is required when AI_PROVIDER=openai-compatible.",
      });
    }
  }
});

export type RawEnvironment = Record<string, string | undefined>;

/**
 * Vercel exposes the current deployment and production hostnames as bare
 * hostnames. Same-origin POSTs still carry an Origin header, so those hosts
 * must be accepted in addition to the configured FRONTEND_ORIGIN values.
 */
function vercelOrigins(environment: RawEnvironment): string[] {
  return ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]
    .map((key) => environment[key]?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`));
}

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  frontendOrigins: string[];
  mongoUri: string;
  sessionSecret: string;
  sessionTtlMs: number;
  guestCookieTtlMs: number;
  trustProxy: boolean;
  caseGenerationLimitPerHour: number;
  hintRateLimitPerHour: number;
  apiRateLimitWindowMs: number;
  apiRateLimitMax: number;
  maxScenarioLength: number;
  maxGenerationAttempts: number;
  hintLimit: number;
  requestBodyLimit: string;
  logLevel: string;
  aiProvider: "mock" | "openai-compatible";
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTimeoutMs: number;
  aiMaxRetries: number;
  aiMaxOutputTokens: number;
  mediaProvider: "none" | "static";
  version: string;
}

export function loadConfig(environment: RawEnvironment = process.env): AppConfig {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  const env = parsed.data;
  const frontendOrigins = [
    ...new Set([
      ...env.FRONTEND_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...vercelOrigins(environment),
    ]),
  ];

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    port: env.PORT,
    frontendOrigins,
    mongoUri: env.MONGODB_URI,
    sessionSecret: env.SESSION_SECRET,
    sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    guestCookieTtlMs: env.GUEST_COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000,
    trustProxy: env.TRUST_PROXY,
    caseGenerationLimitPerHour: env.CASE_GENERATION_LIMIT_PER_HOUR,
    hintRateLimitPerHour: env.HINT_RATE_LIMIT_PER_HOUR,
    apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
    apiRateLimitMax: env.API_RATE_LIMIT_MAX,
    maxScenarioLength: env.MAX_SCENARIO_LENGTH,
    maxGenerationAttempts: env.MAX_GENERATION_ATTEMPTS,
    hintLimit: env.HINT_LIMIT,
    requestBodyLimit: env.REQUEST_BODY_LIMIT,
    logLevel: env.LOG_LEVEL,
    aiProvider: env.AI_PROVIDER,
    aiBaseUrl: env.AI_BASE_URL.replace(/\/+$/, ""),
    aiApiKey: env.AI_API_KEY,
    aiModel: env.AI_MODEL,
    aiTimeoutMs: env.AI_TIMEOUT_MS,
    aiMaxRetries: env.AI_MAX_RETRIES,
    aiMaxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    mediaProvider: env.MEDIA_PROVIDER,
    version: "0.1.0",
  };
}
