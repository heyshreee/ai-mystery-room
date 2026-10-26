import { z } from "zod";
import {
  CATEGORY_VALUES,
  DIFFICULTY_VALUES,
  EVIDENCE_PREFERENCE_VALUES,
  MAX_EVIDENCE_PREFERENCES,
  SCENARIO_MAX_LENGTH,
  SCENARIO_MIN_LENGTH,
} from "./constants.js";

export const objectIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Must be a valid 24-character identifier.");

export const scenarioSchema = (maxLength = SCENARIO_MAX_LENGTH) =>
  z
    .string()
    .trim()
    .min(SCENARIO_MIN_LENGTH, `Scenario must be at least ${SCENARIO_MIN_LENGTH} characters.`)
    .max(maxLength, `Scenario must be at most ${maxLength} characters.`)
    .refine(
      // Control characters are rejected because they corrupt stored case text.
      // eslint-disable-next-line no-control-regex
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
      "Scenario contains unsupported control characters.",
    );

const evidencePreferencesSchema = z
  .array(z.enum(EVIDENCE_PREFERENCE_VALUES))
  .max(
    MAX_EVIDENCE_PREFERENCES,
    `Choose no more than ${MAX_EVIDENCE_PREFERENCES} evidence preferences.`,
  )
  .refine(
    (values) => new Set(values).size === values.length,
    "Evidence preferences must not contain duplicates.",
  )
  .default([]);

export const sampleCaseRequestSchema = z.strictObject({
  sample: z.literal(true),
});

export const customCaseRequestSchema = z.strictObject({
  scenario: scenarioSchema(),
  category: z.enum(CATEGORY_VALUES, {
    message: "Choose a supported category.",
  }),
  difficulty: z.enum(DIFFICULTY_VALUES, {
    message: "Choose easy, medium, or hard.",
  }),
  evidencePreferences: evidencePreferencesSchema,
});

export const createCaseRequestSchema = z.union([
  sampleCaseRequestSchema,
  customCaseRequestSchema,
]);

export type SampleCaseRequest = z.infer<typeof sampleCaseRequestSchema>;
export type CustomCaseRequest = z.infer<typeof customCaseRequestSchema>;
export type CreateCaseRequest = z.infer<typeof createCaseRequestSchema>;

export const createSessionRequestSchema = z.strictObject({
  caseId: objectIdSchema,
});

export const progressRequestSchema = z.strictObject({
  viewedEvidenceId: objectIdSchema,
});

export const hintRequestSchema = z.strictObject({});

export const accusationRequestSchema = z.strictObject({
  suspectId: objectIdSchema,
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must be at least 8 characters.")
  .max(100, "Idempotency-Key must be at most 100 characters.")
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Idempotency-Key may contain letters, numbers, dots, underscores, colons, and dashes.",
  );

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type ProgressRequest = z.infer<typeof progressRequestSchema>;
export type AccusationRequest = z.infer<typeof accusationRequestSchema>;
