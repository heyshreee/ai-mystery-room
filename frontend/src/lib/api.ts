import type {
  CaseCreatedView,
  CustomCaseRequest,
  EvidenceDetail,
  EvidenceListView,
  GameSessionView,
  GenerationStatusView,
  HealthView,
  HintView,
  PublicCase,
  ResultView,
} from "@amr/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export interface ApiErrorDetailView {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetailView[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: ApiErrorDetailView[]; requestId?: string } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "The case file could not be reached. Check your connection and try again.",
    );
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const error = isErrorEnvelope(payload) ? payload.error : undefined;
    throw new ApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "The request could not be completed.",
      {
        details: error?.details,
        requestId: error?.requestId,
      },
    );
  }

  if (!isDataEnvelope<T>(payload)) {
    throw new ApiError(
      502,
      "INTERNAL_ERROR",
      "The case file returned an unexpected response.",
    );
  }
  return payload.data;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isDataEnvelope<T>(value: unknown): value is { data: T } {
  return typeof value === "object" && value !== null && "data" in value;
}

function isErrorEnvelope(value: unknown): value is {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetailView[];
    requestId?: string;
  };
} {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export type CustomCaseCreationResult = CaseCreatedView | GenerationStatusView;

export const api = {
  getHealth(signal?: AbortSignal) {
    return request<HealthView>("/health", { signal });
  },

  createSampleCase(idempotencyKey?: string, signal?: AbortSignal) {
    return request<CaseCreatedView>("/cases", {
      method: "POST",
      body: { sample: true },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      signal,
    });
  },

  createCustomCase(
    body: CustomCaseRequest,
    idempotencyKey?: string,
    signal?: AbortSignal,
  ) {
    return request<CustomCaseCreationResult>("/cases", {
      method: "POST",
      body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      signal,
    });
  },

  getCase(caseId: string, signal?: AbortSignal) {
    return request<PublicCase>(`/cases/${caseId}`, { signal });
  },

  listEvidence(caseId: string, signal?: AbortSignal) {
    return request<EvidenceListView>(`/cases/${caseId}/evidence`, { signal });
  },

  getEvidence(evidenceId: string, signal?: AbortSignal) {
    return request<EvidenceDetail>(`/evidence/${evidenceId}`, { signal });
  },

  createSession(caseId: string, signal?: AbortSignal) {
    return request<GameSessionView>("/sessions", {
      method: "POST",
      body: { caseId },
      signal,
    });
  },

  getSession(sessionId: string, signal?: AbortSignal) {
    return request<GameSessionView>(`/sessions/${sessionId}`, { signal });
  },

  recordProgress(sessionId: string, evidenceId: string) {
    return request<GameSessionView>(`/sessions/${sessionId}/progress`, {
      method: "PATCH",
      body: { viewedEvidenceId: evidenceId },
    });
  },

  requestHint(sessionId: string) {
    return request<HintView>(`/sessions/${sessionId}/hints`, {
      method: "POST",
      body: {},
    });
  },

  submitAccusation(sessionId: string, suspectId: string) {
    return request<ResultView>(`/sessions/${sessionId}/accusations`, {
      method: "POST",
      body: { suspectId },
    });
  },

  getResults(sessionId: string, signal?: AbortSignal) {
    return request<ResultView>(`/sessions/${sessionId}/results`, { signal });
  },

  getGenerationStatus(generationId: string, signal?: AbortSignal) {
    return request<GenerationStatusView>(`/generation/${generationId}`, { signal });
  },
};
