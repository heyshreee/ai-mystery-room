import { describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleProvider,
  parseJsonContent,
} from "../generation/openai-compatible-provider.js";
import { ProviderError } from "../generation/types.js";

const INPUT = {
  systemPrompt: "System instructions",
  userPrompt: "User brief",
  schemaName: "case_blueprint",
  schema: { type: "object" },
  temperature: 0.2,
  timeoutMs: 1_000,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completion(content: string): Response {
  return jsonResponse({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 120, completion_tokens: 240 },
  });
}

function createProvider(
  fetchImpl: typeof fetch,
  overrides: Partial<{
    baseUrl: string;
    apiKey: string;
    maxRetries: number;
    timeoutMs: number;
    maxOutputTokens: number;
  }> = {},
) {
  const sleep = vi.fn(async () => {});
  const provider = new OpenAICompatibleProvider({
    baseUrl: overrides.baseUrl ?? "https://provider.example/v1",
    apiKey: overrides.apiKey ?? "test-secret-key",
    model: "test-model",
    timeoutMs: overrides.timeoutMs ?? 1_000,
    maxRetries: overrides.maxRetries ?? 0,
    maxOutputTokens: overrides.maxOutputTokens ?? 4_096,
    fetchImpl,
    sleep,
  });
  return { provider, sleep };
}

describe("OpenAI-compatible provider adapter", () => {
  it("sends an OpenAI-compatible chat request and parses structured content", async () => {
    const fetchImpl = vi.fn(async () =>
      completion('```json\n{"title":"A fictional case"}\n```'),
    ) as unknown as typeof fetch;
    const { provider } = createProvider(fetchImpl);

    const result = await provider.generateStructured(INPUT);

    expect(result).toEqual({ title: "A fictional case" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://provider.example/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-secret-key",
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "test-model",
      temperature: 0.2,
      max_tokens: 4_096,
      response_format: { type: "json_object" },
      stream: false,
    });
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "System instructions",
    });
    expect(body.messages[1].content).toContain("User brief");
    expect(body.messages[1].content).toContain("case_blueprint");
    expect(String(init.body)).not.toContain("test-secret-key");
  });

  it("does not duplicate an endpoint that is already a chat-completions URL", async () => {
    const fetchImpl = vi.fn(async () => completion('{"ok":true}')) as unknown as typeof fetch;
    const { provider } = createProvider(fetchImpl, {
      baseUrl: "https://provider.example/v1/chat/completions/",
    });

    await provider.generateStructured(INPUT);

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
    ];
    expect(url).toBe("https://provider.example/v1/chat/completions");
  });

  it("retries a temporary 503 with bounded backoff", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "busy" }, 503))
      .mockResolvedValueOnce(completion('{"ok":true}')) as unknown as typeof fetch;
    const { provider, sleep } = createProvider(fetchImpl, { maxRetries: 2 });

    const result = await provider.generateStructured(INPUT);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("stops after the configured retry limit and returns a safe category", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "upstream details that must not leak" }, 503),
    ) as unknown as typeof fetch;
    const { provider, sleep } = createProvider(fetchImpl, { maxRetries: 2 });

    const error = await provider.generateStructured(INPUT).catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      name: "ProviderError",
      code: "AI_PROVIDER_UNAVAILABLE",
      retryable: true,
    });
    expect((error as Error).message).not.toContain("upstream details");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry rejected credentials", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "invalid key" }, 401),
    ) as unknown as typeof fetch;
    const { provider, sleep } = createProvider(fetchImpl, { maxRetries: 3 });

    await expect(provider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("normalizes an aborted request as a retryable timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }) as unknown as typeof fetch;
    const { provider, sleep } = createProvider(fetchImpl, { maxRetries: 1 });

    await expect(provider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "GENERATION_TIMEOUT",
      retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed or missing model output without leaking raw content", async () => {
    const malformed = vi.fn(async () =>
      completion("Not JSON at all, with secret-looking text abc123"),
    ) as unknown as typeof fetch;
    const { provider: malformedProvider } = createProvider(malformed, {
      maxRetries: 0,
    });

    await expect(malformedProvider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      retryable: true,
    });

    const empty = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "" } }] }),
    ) as unknown as typeof fetch;
    const { provider: emptyProvider } = createProvider(empty, { maxRetries: 0 });
    await expect(emptyProvider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
    });

    const noChoices = vi.fn(async () => jsonResponse({ choices: [] })) as unknown as typeof fetch;
    const { provider: noChoicesProvider } = createProvider(noChoices, {
      maxRetries: 0,
    });
    await expect(noChoicesProvider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
    });
  });

  it("does not retry a non-retryable request rejection", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "bad request" }, 400),
    ) as unknown as typeof fetch;
    const { provider, sleep } = createProvider(fetchImpl, { maxRetries: 2 });

    await expect(provider.generateStructured(INPUT)).rejects.toMatchObject({
      code: "INVALID_AI_OUTPUT",
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("surfaces only safe provider error messages", () => {
    const error = new ProviderError(
      "AI_PROVIDER_UNAVAILABLE",
      "The generation provider is temporarily unavailable.",
      { retryable: true },
    );
    expect(error.message).not.toContain("test-secret-key");
    expect(error.code).toBe("AI_PROVIDER_UNAVAILABLE");
  });
});

describe("provider JSON parsing", () => {
  it("accepts fenced JSON and surrounding commentary", () => {
    expect(parseJsonContent('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonContent('Here is the case: {"a":2} Thank you.')).toEqual({ a: 2 });
  });

  it("rejects content without a JSON object", () => {
    expect(() => parseJsonContent("no braces here")).toThrowError(ProviderError);
  });
});
