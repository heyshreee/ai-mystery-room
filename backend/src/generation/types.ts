import type { ErrorCode } from "@amr/shared";
import type { Category, Difficulty, EvidencePreference } from "@amr/shared";

export interface GenerationRequest {
  scenario: string;
  category: Category;
  difficulty: Difficulty;
  evidencePreferences: EvidencePreference[];
}

export interface StructuredGenerationInput {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schema: unknown;
  temperature?: number;
  timeoutMs: number;
  /**
   * Optional structured context for providers that generate locally. Live
   * providers must ignore it unless their adapter explicitly documents its use.
   */
  context?: GenerationRequest;
}

export interface AIProvider {
  readonly id: string;
  generateStructured(input: StructuredGenerationInput): Promise<unknown>;
}

export type ProviderFailureCode = Extract<
  ErrorCode,
  | "AI_PROVIDER_UNAVAILABLE"
  | "GENERATION_TIMEOUT"
  | "INVALID_AI_OUTPUT"
  | "GENERATION_FAILED"
>;

export class ProviderError extends Error {
  readonly code: ProviderFailureCode;
  readonly retryable: boolean;

  constructor(
    code: ProviderFailureCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}
