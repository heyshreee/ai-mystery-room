import {
  customCaseRequestSchema,
  type Category,
  type CustomCaseRequest,
  type Difficulty,
  type EvidencePreference,
} from "@amr/shared";
import type { ApiErrorDetailView } from "./api";

export interface CaseFormValues {
  scenario: string;
  category: Category;
  difficulty: Difficulty;
  evidencePreferences: EvidencePreference[];
}

export type CaseFormField =
  | "scenario"
  | "category"
  | "difficulty"
  | "evidencePreferences";

export type CaseFormErrors = Partial<Record<CaseFormField, string>>;

export type CaseFormValidation =
  | { ok: true; data: CustomCaseRequest }
  | { ok: false; errors: CaseFormErrors };

export function validateCaseForm(values: CaseFormValues): CaseFormValidation {
  const parsed = customCaseRequestSchema.safeParse(values);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const errors: CaseFormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (
      (field === "scenario" ||
        field === "category" ||
        field === "difficulty" ||
        field === "evidencePreferences") &&
      !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }

  if (Object.keys(errors).length === 0) {
    errors.scenario = "Please review the case details and try again.";
  }

  return { ok: false, errors };
}

export function fieldErrorsFromApi(details: ApiErrorDetailView[] | undefined): CaseFormErrors {
  const errors: CaseFormErrors = {};
  for (const detail of details ?? []) {
    const root = detail.field.split(".")[0];
    if (
      root === "scenario" ||
      root === "category" ||
      root === "difficulty" ||
      root === "evidencePreferences"
    ) {
      errors[root] ??= detail.message;
    }
  }
  return errors;
}
