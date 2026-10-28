import { describe, expect, it } from "vitest";
import { loadConfig, type RawEnvironment } from "../config/env.js";

const BASE_ENV: RawEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://amr_app:secret@127.0.0.1:5432/postgres",
  DATABASE_SSL: "disable",
  SESSION_SECRET: "a_test_session_secret_longer_than_thirty_two_characters",
  LOG_LEVEL: "silent",
};

describe("environment configuration", () => {
  it("defaults to the deterministic mock provider and static media", () => {
    const config = loadConfig(BASE_ENV);
    expect(config.aiProvider).toBe("mock");
    expect(config.mediaProvider).toBe("static");
    expect(config.aiTimeoutMs).toBe(60_000);
    expect(config.aiMaxRetries).toBe(2);
    expect(config.aiMaxOutputTokens).toBe(8_000);
    expect(config.maxGenerationAttempts).toBe(3);
    expect(config.hintLimit).toBe(3);
  });

  it("includes Vercel deployment hostnames in the origin allowlist", () => {
    const config = loadConfig({
      ...BASE_ENV,
      FRONTEND_ORIGIN: "https://example.test,http://localhost:5173",
      VERCEL_PROJECT_PRODUCTION_URL: "ai-mystery-room.vercel.app",
      VERCEL_URL: "ai-mystery-room-git-main-heyshreee.vercel.app",
    });

    expect(config.frontendOrigins).toEqual([
      "https://example.test",
      "http://localhost:5173",
      "https://ai-mystery-room.vercel.app",
      "https://ai-mystery-room-git-main-heyshreee.vercel.app",
    ]);
  });

  it("accepts a provider-neutral OpenAI-compatible configuration", () => {
    const config = loadConfig({
      ...BASE_ENV,
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://gateway.example/v1/",
      AI_API_KEY: "private-test-key",
      AI_MODEL: "local-model",
      AI_TIMEOUT_MS: "15000",
      AI_MAX_RETRIES: "1",
      AI_MAX_OUTPUT_TOKENS: "4096",
      MEDIA_PROVIDER: "none",
    });

    expect(config.aiProvider).toBe("openai-compatible");
    expect(config.aiBaseUrl).toBe("https://gateway.example/v1");
    expect(config.aiApiKey).toBe("private-test-key");
    expect(config.aiModel).toBe("local-model");
    expect(config.aiTimeoutMs).toBe(15_000);
    expect(config.aiMaxRetries).toBe(1);
    expect(config.aiMaxOutputTokens).toBe(4_096);
    expect(config.mediaProvider).toBe("none");
  });

  it("requires the base URL and model for a live-compatible provider", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        AI_PROVIDER: "openai-compatible",
      }),
    ).toThrow(/AI_BASE_URL/);

    expect(() =>
      loadConfig({
        ...BASE_ENV,
        AI_PROVIDER: "openai-compatible",
        AI_BASE_URL: "https://gateway.example/v1",
      }),
    ).toThrow(/AI_MODEL/);
  });

  it("rejects a non-HTTP provider URL", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        AI_PROVIDER: "openai-compatible",
        AI_BASE_URL: "file:///etc/passwd",
        AI_MODEL: "local-model",
      }),
    ).toThrow(/AI_BASE_URL/);
  });

  it("rejects unsupported providers and media modes", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, AI_PROVIDER: "some-vendor" }),
    ).toThrow(/AI_PROVIDER/);
    expect(() =>
      loadConfig({ ...BASE_ENV, MEDIA_PROVIDER: "live-video" }),
    ).toThrow(/MEDIA_PROVIDER/);
  });

  it("rejects unbounded or nonsensical generation limits", () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, AI_TIMEOUT_MS: "500" }),
    ).toThrow(/AI_TIMEOUT_MS/);
    expect(() =>
      loadConfig({ ...BASE_ENV, AI_MAX_RETRIES: "9" }),
    ).toThrow(/AI_MAX_RETRIES/);
    expect(() =>
      loadConfig({ ...BASE_ENV, MAX_GENERATION_ATTEMPTS: "0" }),
    ).toThrow(/MAX_GENERATION_ATTEMPTS/);
    expect(() =>
      loadConfig({ ...BASE_ENV, AI_MAX_OUTPUT_TOKENS: "10" }),
    ).toThrow(/AI_MAX_OUTPUT_TOKENS/);
  });

  it("does not include the API key in a configuration error", () => {
    const secret = "super-secret-provider-key";
    try {
      loadConfig({
        ...BASE_ENV,
        AI_PROVIDER: "openai-compatible",
        AI_API_KEY: secret,
        AI_BASE_URL: "not-a-url",
        AI_MODEL: "local-model",
      });
      throw new Error("Expected configuration to fail");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("keeps the sample secret placeholder out of accepted configurations", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        SESSION_SECRET: "replace_with_a_long_random_secret_value_here",
      }),
    ).toThrow(/SESSION_SECRET/);
  });
});
