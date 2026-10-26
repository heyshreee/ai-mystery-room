import { describe, expect, it } from "vitest";
import type { CaseCreatedView, GenerationStatusView } from "@amr/shared";
import {
  GENERATION_PROGRESS_STEPS,
  generationProviderLabel,
  generationStageLabel,
  generationStepState,
  isGenerationInFlight,
  isGenerationStatusView,
} from "./generation";

function status(overrides: Partial<GenerationStatusView> = {}): GenerationStatusView {
  return {
    id: "a".repeat(24),
    caseId: "b".repeat(24),
    status: "pending",
    stage: "queued",
    provider: "mock",
    createdAt: "2026-10-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("generation progress helpers", () => {
  it("advances the visible step list only through reported stages", () => {
    expect(generationStepState("queued", "normalizing_brief")).toBe("active");
    expect(generationStepState("normalizing_brief", "normalizing_brief")).toBe("active");
    expect(generationStepState("normalizing_brief", "drafting_blueprint")).toBe(
      "waiting",
    );
    expect(generationStepState("drafting_blueprint", "normalizing_brief")).toBe(
      "complete",
    );
    expect(generationStepState("drafting_blueprint", "drafting_blueprint")).toBe(
      "active",
    );
    expect(generationStepState("repairing_blueprint", "drafting_blueprint")).toBe(
      "active",
    );
    expect(generationStepState("validating_case", "drafting_blueprint")).toBe(
      "complete",
    );
    expect(generationStepState("validating_case", "validating_case")).toBe("active");
    expect(generationStepState("validating_case", "publishing")).toBe("waiting");
    expect(generationStepState("publishing", "publishing")).toBe("active");
    expect(generationStepState("published", "publishing")).toBe("complete");
    expect(
      GENERATION_PROGRESS_STEPS.every(
        (step) => generationStepState("published", step.stage) === "complete",
      ),
    ).toBe(true);
  });

  it("does not claim progress for an unknown stage", () => {
    expect(generationStepState("something_new", "drafting_blueprint")).toBe("waiting");
  });

  it("labels stages and providers without inventing a live provider", () => {
    expect(generationStageLabel("validating_case")).toBe("Checking timeline and clues");
    expect(generationStageLabel("unrecognized")).toBe("Preparing the case file");
    expect(generationProviderLabel("mock")).toContain("deterministic");
    expect(generationProviderLabel("openai-compatible")).toBe(
      "Configured server-side provider (openai-compatible)",
    );
  });

  it("treats only pending and validating generations as in flight", () => {
    expect(isGenerationInFlight(status({ status: "pending" }))).toBe(true);
    expect(isGenerationInFlight(status({ status: "validating" }))).toBe(true);
    expect(isGenerationInFlight(status({ status: "ready" }))).toBe(false);
    expect(isGenerationInFlight(status({ status: "failed" }))).toBe(false);
  });

  it("distinguishes a generation status from an immediately ready case", () => {
    const readyCase = {
      case: { id: "b".repeat(24) },
      generationId: "a".repeat(24),
      sample: false,
    } as CaseCreatedView;

    expect(isGenerationStatusView(status())).toBe(true);
    expect(isGenerationStatusView(readyCase)).toBe(false);
  });
});
