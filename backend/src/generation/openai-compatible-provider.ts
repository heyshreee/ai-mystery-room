import type { Logger } from "../utils/logger.js";
import { ProviderError, type AIProvider, type StructuredGenerationInput } from "./types.js";

export interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  logger?: Logger;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * A provider-neutral adapter for the widely implemented OpenAI-compatible
 * chat-completions protocol. The base URL decides whether this points at a
 * hosted service, a self-hosted gateway, or a local inference server.
 *
 * It deliberately uses JSON-object mode plus deterministic schema validation
 * because not every compatible server supports strict JSON Schema response
 * formats.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai-compatible";

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxOutputTokens: number;
  private readonly logger?: Logger;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey || undefined;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
    this.maxOutputTokens = options.maxOutputTokens;
    this.logger = options.logger;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolvePromise) => {
          setTimeout(resolvePromise, milliseconds);
        }));
  }

  async generateStructured(input: StructuredGenerationInput): Promise<unknown> {
    const endpoint = this.endpoint();
    const body = this.requestBody(input);
    let lastError: ProviderError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await this.fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!response.ok) {
          const failure = providerHttpError(response.status);
          this.logger?.warn(
            {
              provider: this.id,
              attempt: attempt + 1,
              status: response.status,
              durationMs: Date.now() - startedAt,
              errorCode: failure.code,
            },
            "generation provider returned an error",
          );
          if (!failure.retryable || attempt >= this.maxRetries) {
            throw failure;
          }
          lastError = failure;
          await this.sleep(backoffMs(attempt));
          continue;
        }

        const payload = (await response.json()) as ChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new ProviderError(
            "INVALID_AI_OUTPUT",
            "The generation provider returned no structured content.",
            { retryable: true },
          );
        }

        const parsed = parseJsonContent(content);
        this.logger?.info(
          {
            provider: this.id,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
            inputTokens: payload.usage?.prompt_tokens,
            outputTokens: payload.usage?.completion_tokens,
          },
          "generation provider responded",
        );
        return parsed;
      } catch (error) {
        const failure = normalizeProviderError(error);
        if (!failure.retryable || attempt >= this.maxRetries) {
          throw failure;
        }
        lastError = failure;
        this.logger?.warn(
          {
            provider: this.id,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
            errorCode: failure.code,
          },
          "generation provider attempt failed; retrying",
        );
        await this.sleep(backoffMs(attempt));
      }
    }

    throw (
      lastError ??
      new ProviderError(
        "AI_PROVIDER_UNAVAILABLE",
        "The generation provider could not be reached.",
      )
    );
  }

  private endpoint(): string {
    if (/\/chat\/completions$/i.test(this.baseUrl)) {
      return this.baseUrl;
    }
    return `${this.baseUrl}/chat/completions`;
  }

  private requestBody(input: StructuredGenerationInput): Record<string, unknown> {
    const schemaAppendix = input.schema
      ? `\n\nSchema name: ${input.schemaName}\nReturn a JSON object with this shape:\n${JSON.stringify(input.schema)}`
      : `\n\nSchema name: ${input.schemaName}`;

    return {
      model: this.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: `${input.userPrompt}${schemaAppendix}` },
      ],
      temperature: input.temperature ?? 0.4,
      max_tokens: this.maxOutputTokens,
      response_format: { type: "json_object" },
      stream: false,
    };
  }
}

function providerHttpError(status: number): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      "AI_PROVIDER_UNAVAILABLE",
      "The generation provider rejected its configured credentials.",
      { retryable: false },
    );
  }
  if (status === 404) {
    return new ProviderError(
      "AI_PROVIDER_UNAVAILABLE",
      "The configured generation provider endpoint was not found.",
      { retryable: false },
    );
  }
  if (status === 408) {
    return new ProviderError(
      "GENERATION_TIMEOUT",
      "The generation provider timed out.",
      { retryable: true },
    );
  }
  if (status === 429 || status >= 500) {
    return new ProviderError(
      "AI_PROVIDER_UNAVAILABLE",
      "The generation provider is temporarily unavailable.",
      { retryable: true },
    );
  }
  return new ProviderError(
    "INVALID_AI_OUTPUT",
    `The generation provider rejected the request (HTTP ${status}).`,
    { retryable: false },
  );
}

function normalizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (isAbortError(error)) {
    return new ProviderError(
      "GENERATION_TIMEOUT",
      "The generation provider did not respond before the timeout.",
      { retryable: true, cause: error },
    );
  }
  return new ProviderError(
    "AI_PROVIDER_UNAVAILABLE",
    "The generation provider could not be reached.",
    { retryable: true, cause: error },
  );
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name?: unknown }).name === "TimeoutError" ||
      (error as { name?: unknown }).name === "AbortError")
  );
}

export function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const firstBrace = unfenced.indexOf("{");
    const lastBrace = unfenced.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through to the safe error below.
      }
    }
    throw new ProviderError(
      "INVALID_AI_OUTPUT",
      "The generation provider returned content that was not valid JSON.",
      { retryable: true },
    );
  }
}

function backoffMs(attempt: number): number {
  return Math.min(4_000, 250 * 2 ** Math.min(attempt, 4));
}
