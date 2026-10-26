import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { MockAIProvider } from "./mock-provider.js";
import { OpenAICompatibleProvider } from "./openai-compatible-provider.js";
import type { AIProvider } from "./types.js";

export function createAIProvider(config: AppConfig, logger: Logger): AIProvider {
  if (config.aiProvider === "openai-compatible") {
    return new OpenAICompatibleProvider({
      baseUrl: config.aiBaseUrl,
      apiKey: config.aiApiKey,
      model: config.aiModel,
      timeoutMs: config.aiTimeoutMs,
      maxRetries: config.aiMaxRetries,
      maxOutputTokens: config.aiMaxOutputTokens,
      logger,
    });
  }
  return new MockAIProvider();
}
