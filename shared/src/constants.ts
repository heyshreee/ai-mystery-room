export const CATEGORY_VALUES = [
  "theft",
  "missing_person",
  "fraud",
  "sabotage",
  "other",
] as const;

export type Category = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  theft: "Theft",
  missing_person: "Missing person",
  fraud: "Fraud",
  sabotage: "Sabotage",
  other: "Other",
};

export const DIFFICULTY_VALUES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTY_VALUES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const EVIDENCE_TYPE_VALUES = [
  "chat_transcript",
  "image",
  "cctv_log",
  "cctv_transcript",
  "witness_statement",
  "suspect_statement",
  "access_log",
  "document",
  "timeline_event",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPE_VALUES)[number];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  chat_transcript: "Chat transcript",
  image: "Image exhibit",
  cctv_log: "CCTV log",
  cctv_transcript: "CCTV transcript",
  witness_statement: "Witness statement",
  suspect_statement: "Suspect statement",
  access_log: "Access log",
  document: "Document",
  timeline_event: "Timeline event",
};

/**
 * Evidence types a player may request as a generation preference. The
 * timeline is not an evidence exhibit, so it is not offered as a preference.
 */
export const EVIDENCE_PREFERENCE_VALUES = [
  "chat_transcript",
  "image",
  "cctv_log",
  "cctv_transcript",
  "witness_statement",
  "suspect_statement",
  "access_log",
  "document",
] as const;

export type EvidencePreference = (typeof EVIDENCE_PREFERENCE_VALUES)[number];

export const RELIABILITY_VALUES = ["low", "medium", "high", "unknown"] as const;
export type Reliability = (typeof RELIABILITY_VALUES)[number];

export const RELIABILITY_LABELS: Record<Reliability, string> = {
  low: "Low reliability",
  medium: "Medium reliability",
  high: "High reliability",
  unknown: "Unverified reliability",
};

export const MEDIA_STATUS_VALUES = [
  "not_required",
  "pending",
  "ready",
  "failed",
] as const;
export type MediaStatus = (typeof MEDIA_STATUS_VALUES)[number];

export const SESSION_STATUS_VALUES = ["investigating", "completed", "expired"] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

export const SCENARIO_MIN_LENGTH = 30;
export const SCENARIO_MAX_LENGTH = 2000;
export const MAX_EVIDENCE_PREFERENCES = 5;
export const DEFAULT_HINT_LIMIT = 3;
export const CORRECT_BASE_SCORE = 100;
export const HINT_PENALTY = 10;
export const SAMPLE_CASE_KEY = "the-meridian-at-midnight";

export const GUEST_COOKIE_NAME = "amr_guest";
export const SESSION_COOKIE_NAME = "amr_session";

export const FICTION_NOTICE =
  "AI Mystery Room is an interactive work of fiction. Every person, place, message, image, and record is simulated for the puzzle and must not be treated as real evidence or as a claim about real events.";

export const SAMPLE_FICTION_NOTICE =
  "This sample case is hand-authored fiction. Its people, museum, messages, images, and records are simulated and do not depict real events.";

export const MAX_SUSPECTS = 6;
export const MIN_SUSPECTS = 3;

export const GENERATION_STAGES = [
  "queued",
  "normalizing_brief",
  "drafting_blueprint",
  "repairing_blueprint",
  "validating_case",
  "publishing",
  "published",
  "failed",
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const GENERATION_STAGE_LABELS: Record<GenerationStage, string> = {
  queued: "Brief accepted",
  normalizing_brief: "Normalizing the brief",
  drafting_blueprint: "Drafting the case blueprint",
  repairing_blueprint: "Repairing the blueprint",
  validating_case: "Checking timeline and clues",
  publishing: "Publishing the case file",
  published: "Case ready",
  failed: "Generation failed",
};
