import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("unwraps a successful data envelope and sends guest credentials", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { id: "case_1", title: "The Meridian at Midnight" } }),
    );

    const result = await api.getCase("case_1");

    expect(result).toEqual({ id: "case_1", title: "The Meridian at Midnight" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cases/case_1",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("sends sample creation as JSON with an Idempotency-Key", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { case: { id: "case_1" }, generationId: "gen_1", sample: true } }),
    );

    await api.createSampleCase("sample-abc123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cases",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ sample: true }),
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": "sample-abc123",
        }),
      }),
    );
  });

  it("maps an error envelope to an ApiError with details and request id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "AI_PROVIDER_UNAVAILABLE",
            message: "Live generation is not available in this build.",
            details: [{ field: "scenario", message: "Unable to generate this brief." }],
            requestId: "req_123456789",
          },
        },
        { status: 503 },
      ),
    );

    await expect(
      api.createCustomCase({
        scenario: "A sealed gallery and a missing astronomical sphere.",
        category: "theft",
        difficulty: "medium",
        evidencePreferences: [],
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "Live generation is not available in this build.",
      details: [{ field: "scenario", message: "Unable to generate this brief." }],
      requestId: "req_123456789",
    });
  });

  it("uses a stable network error when fetch itself fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const rejection = api.getCase("case_1");

    await expect(rejection).rejects.toBeInstanceOf(ApiError);
    await expect(rejection).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("passes an AbortError through untouched", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    await expect(api.getCase("case_1")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects a successful response without a data envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "case_1" }));

    await expect(api.getCase("case_1")).rejects.toMatchObject({
      status: 502,
      code: "INTERNAL_ERROR",
      message: "The case file returned an unexpected response.",
    });
  });

  it("falls back to a generic error for non-JSON error responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("upstream unavailable", {
        status: 503,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(api.getCase("case_1")).rejects.toMatchObject({
      status: 503,
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    });
  });
});
