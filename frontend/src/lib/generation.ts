import {
  GENERATION_STAGE_LABELS,
  type GenerationStage,
  type GenerationStatusView,
} from "@amr/shared";
import type { CustomCaseCreationResult } from "./api";

export const GENERATION_POLL_INTERVAL_MS = 1_200;

export interface GenerationProgressStep {
  stage: GenerationStage;
  label: string;
  summary: string;
}

/**
 * A small, honest step list. The server reports a named stage; the client never
 * invents a percentage or claims work that has not been reported.
 */
export const GENERATION_PROGRESS_STEPS: GenerationProgressStep[] = [
  {
    stage: "normalizing_brief",
    label: "Read the brief",
    summary: "Normalize the scenario and the requested evidence types.",
  },
  {
    stage: "drafting_blueprint",
    label: "Draft the case",
    summary: "Fix one culprit before writing suspects, timeline, and clues.",
  },
  {
    stage: "validating_case",
    label: "Check the file",
    summary: "Validate references, timeline order, and clue coverage.",
  },
  {
    stage: "publishing",
    label: "Publish the file",
    summary: "Save the validated case and make it playable.",
  },
];

const STAGE_POSITION: Record<GenerationStage, number> = {
  queued: 0,
  normalizing_brief: 1,
  drafting_blueprint: 2,
  repairing_blueprint: 2,
  validating_case: 3,
  publishing: 4,
  published: 5,
  failed: 0,
};

export type GenerationStepState = "complete" | "active" | "waiting";

export function generationStageLabel(stage: string): string {
  return GENERATION_STAGE_LABELS[stage as GenerationStage] ?? "Preparing the case file";
}

export function generationStepState(
  stage: string,
  stepStage: GenerationStage,
): GenerationStepState {
  const position = STAGE_POSITION[stage as GenerationStage];
  const stepPosition = STAGE_POSITION[stepStage];
  if (position === undefined) {
    return "waiting";
  }
  if (position >= STAGE_POSITION.published) {
    return "complete";
  }
  if (position === 0) {
    return stepStage === "normalizing_brief" ? "active" : "waiting";
  }
  if (position > stepPosition) {
    return "complete";
  }
  if (position === stepPosition) {
    return "active";
  }
  return "waiting";
}

export function generationProviderLabel(provider: string): string {
  if (provider === "mock") {
    return "Mock generator — deterministic, no network";
  }
  return `Configured server-side provider (${provider})`;
}

export function isGenerationStatusView(
  value: CustomCaseCreationResult,
): value is GenerationStatusView {
  return "stage" in value && "caseId" in value && !("case" in value);
}

export function isGenerationInFlight(status: GenerationStatusView): boolean {
  return status.status === "pending" || status.status === "validating";
}
