import { buildMockBlueprint } from "./mock-blueprint.js";
import type { AIProvider, GenerationRequest, StructuredGenerationInput } from "./types.js";

/**
 * Deterministic local provider used when AI_PROVIDER=mock. It performs no
 * network calls and is clearly identified as a mock in status responses.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock";

  async generateStructured(input: StructuredGenerationInput): Promise<unknown> {
    if (!input.context) {
      throw new Error("Mock provider requires normalized generation context.");
    }
    return buildMockBlueprint(input.context as GenerationRequest);
  }
}
