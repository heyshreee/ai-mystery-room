import { MAX_SUSPECTS, MIN_SUSPECTS } from "@amr/shared";
import type { CaseDocument } from "../models/Case.js";
import type { SuspectDocument } from "../models/Suspect.js";
import type { EvidenceDocument } from "../models/Evidence.js";
import type { SolutionDocument } from "../models/Solution.js";

export interface CaseValidationIssue {
  code: string;
  message: string;
}

export interface CaseValidationResult {
  valid: boolean;
  issues: CaseValidationIssue[];
}

type CaseInput = Pick<
  CaseDocument,
  "title" | "timeline" | "suspectIds" | "evidenceIds" | "incident" | "fictionNotice"
>;

type SuspectInput = Pick<
  SuspectDocument,
  "_id" | "displayName" | "relationships" | "profile" | "motiveSummary" | "publicStatement"
>;

type EvidenceInput = Pick<
  EvidenceDocument,
  | "_id"
  | "caseId"
  | "exhibitNumber"
  | "type"
  | "title"
  | "sourceLabel"
  | "mediaStatus"
  | "mediaUrl"
  | "relatedSuspectIds"
  | "relatedTimelineEventIds"
  | "occurredAt"
>;

type SolutionInput = Pick<
  SolutionDocument,
  | "culpritSuspectId"
  | "canonicalTimeline"
  | "motive"
  | "method"
  | "explanation"
  | "supportingEvidenceIds"
  | "hintTexts"
>;

export interface CaseValidationInput {
  caseDoc: CaseInput;
  suspectDocs: SuspectInput[];
  evidenceDocs: EvidenceInput[];
  solutionDoc: SolutionInput;
}

const MIN_SUPPORTING_EVIDENCE = 2;

export function validateCaseStructure(input: CaseValidationInput): CaseValidationResult {
  const issues: CaseValidationIssue[] = [];
  const { caseDoc, suspectDocs, evidenceDocs, solutionDoc } = input;

  if (suspectDocs.length < MIN_SUSPECTS || suspectDocs.length > MAX_SUSPECTS) {
    issues.push({
      code: "SUSPECT_COUNT",
      message: `A case must have between ${MIN_SUSPECTS} and ${MAX_SUSPECTS} suspects.`,
    });
  }

  const suspectIds = new Set(suspectDocs.map((suspect) => suspect._id));
  const suspectById = new Map(
    suspectDocs.map((suspect) => [suspect._id, suspect] as const),
  );
  if (suspectIds.size !== suspectDocs.length) {
    issues.push({ code: "DUPLICATE_SUSPECT_ID", message: "Suspect IDs must be unique." });
  }

  const displayNames = new Set<string>();
  for (const suspect of suspectDocs) {
    const normalizedName = suspect.displayName.trim().toLowerCase();
    if (displayNames.has(normalizedName)) {
      issues.push({
        code: "DUPLICATE_SUSPECT_NAME",
        message: `Suspect name "${suspect.displayName}" is duplicated.`,
      });
    }
    displayNames.add(normalizedName);

    for (const relationship of suspect.relationships) {
      if (relationship.otherSuspectId === suspect._id) {
        issues.push({
          code: "SELF_RELATIONSHIP",
          message: `${suspect.displayName} cannot have a relationship with themself.`,
        });
      }
      if (!suspectIds.has(relationship.otherSuspectId)) {
        issues.push({
          code: "INVALID_RELATIONSHIP",
          message: `${suspect.displayName} references an unknown suspect in a relationship.`,
        });
      }
    }

    for (const requiredField of [
      suspect.profile,
      suspect.motiveSummary,
      suspect.publicStatement,
    ]) {
      if (!requiredField.trim()) {
        issues.push({
          code: "EMPTY_SUSPECT_FIELD",
          message: `${suspect.displayName} is missing required profile content.`,
        });
      }
    }
  }

  const culprit = suspectById.get(solutionDoc.culpritSuspectId);
  if (!culprit) {
    issues.push({
      code: "CULPRIT_NOT_IN_CASE",
      message: "The canonical culprit must be one of the case suspects.",
    });
  }
  if (!caseDoc.suspectIds.every((id) => suspectIds.has(id))) {
    issues.push({
      code: "CASE_SUSPECT_MISMATCH",
      message: "The case references a suspect that is not part of the case.",
    });
  }

  const publicEventIds = new Set<string>();
  let previousPublicTime = Number.NEGATIVE_INFINITY;
  for (const event of caseDoc.timeline) {
    if (publicEventIds.has(event.eventId)) {
      issues.push({
        code: "DUPLICATE_TIMELINE_EVENT",
        message: `Timeline event ID "${event.eventId}" is duplicated.`,
      });
    }
    publicEventIds.add(event.eventId);
    const time = Date.parse(event.at);
    if (Number.isNaN(time)) {
      issues.push({
        code: "INVALID_TIMELINE_TIME",
        message: `Timeline event "${event.eventId}" has an invalid timestamp.`,
      });
    } else {
      if (time < previousPublicTime) {
        issues.push({
          code: "TIMELINE_OUT_OF_ORDER",
          message: "Public timeline events must be in chronological order.",
        });
      }
      previousPublicTime = time;
    }
    if (!event.location.trim() || !event.description.trim()) {
      issues.push({
        code: "EMPTY_TIMELINE_EVENT",
        message: `Timeline event "${event.eventId}" is incomplete.`,
      });
    }
    if (culprit && namesPerson(event.description, culprit.displayName)) {
      issues.push({
        code: "PUBLIC_TIMELINE_NAMES_CULPRIT",
        message: `Public timeline event "${event.eventId}" names the culprit before the reveal.`,
      });
    }
  }

  if (caseDoc.timeline.length === 0) {
    issues.push({ code: "EMPTY_TIMELINE", message: "A case must have a public timeline." });
  }

  const canonicalIds = new Set<string>();
  let previousCanonicalTime = Number.NEGATIVE_INFINITY;
  for (const event of solutionDoc.canonicalTimeline) {
    if (canonicalIds.has(event.eventId)) {
      issues.push({
        code: "DUPLICATE_CANONICAL_EVENT",
        message: `Canonical timeline event "${event.eventId}" is duplicated.`,
      });
    }
    canonicalIds.add(event.eventId);
    if (!publicEventIds.has(event.eventId)) {
      issues.push({
        code: "CANONICAL_EVENT_NOT_PUBLIC",
        message: `Canonical event "${event.eventId}" is not represented in the public timeline.`,
      });
    }
    const time = Date.parse(event.at);
    if (Number.isNaN(time)) {
      issues.push({
        code: "INVALID_CANONICAL_TIME",
        message: `Canonical event "${event.eventId}" has an invalid timestamp.`,
      });
    } else {
      if (time < previousCanonicalTime) {
        issues.push({
          code: "CANONICAL_TIMELINE_OUT_OF_ORDER",
          message: "Canonical timeline events must be in chronological order.",
        });
      }
      previousCanonicalTime = time;
    }
    for (const suspectId of event.involvedSuspectIds) {
      if (!suspectIds.has(suspectId)) {
        issues.push({
          code: "INVALID_CANONICAL_SUSPECT",
          message: `Canonical event "${event.eventId}" references an unknown suspect.`,
        });
      }
    }
  }

  // A person cannot be in two unrelated places at the exact same instant.
  const positionsBySuspectAndTime = new Map<string, Set<string>>();
  for (const event of solutionDoc.canonicalTimeline) {
    for (const suspectId of event.involvedSuspectIds) {
      const key = `${suspectId}|${event.at}`;
      const locations = positionsBySuspectAndTime.get(key) ?? new Set<string>();
      locations.add(event.location);
      positionsBySuspectAndTime.set(key, locations);
    }
  }
  for (const [key, locations] of positionsBySuspectAndTime) {
    if (locations.size > 1) {
      const suspectId = key.split("|")[0] ?? "unknown";
      issues.push({
        code: "IMPOSSIBLE_POSITION",
        message: `Suspect ${suspectId} appears in multiple locations at one timestamp.`,
      });
    }
  }

  if (evidenceDocs.length === 0) {
    issues.push({ code: "EMPTY_EVIDENCE", message: "A case must include evidence." });
  }

  const evidenceIds = new Set(evidenceDocs.map((evidence) => evidence._id));
  if (evidenceIds.size !== evidenceDocs.length) {
    issues.push({ code: "DUPLICATE_EVIDENCE_ID", message: "Evidence IDs must be unique." });
  }
  const evidenceById = new Map(
    evidenceDocs.map((evidence) => [evidence._id, evidence] as const),
  );
  const exhibitNumbers = new Set<number>();
  const evidenceCaseId = evidenceDocs[0]?.caseId;

  for (const evidence of evidenceDocs) {
    if (exhibitNumbers.has(evidence.exhibitNumber)) {
      issues.push({
        code: "DUPLICATE_EXHIBIT_NUMBER",
        message: `Exhibit number ${evidence.exhibitNumber} is duplicated.`,
      });
    }
    exhibitNumbers.add(evidence.exhibitNumber);

    if (evidenceCaseId && evidence.caseId !== evidenceCaseId) {
      issues.push({
        code: "EVIDENCE_CASE_MISMATCH",
        message: `Evidence "${evidence.title}" belongs to a different case.`,
      });
    }

    for (const suspectId of evidence.relatedSuspectIds) {
      if (!suspectIds.has(suspectId)) {
        issues.push({
          code: "INVALID_EVIDENCE_SUSPECT",
          message: `Evidence "${evidence.title}" references an unknown suspect.`,
        });
      }
    }

    for (const eventId of evidence.relatedTimelineEventIds) {
      if (!publicEventIds.has(eventId)) {
        issues.push({
          code: "INVALID_EVIDENCE_EVENT",
          message: `Evidence "${evidence.title}" references an unknown timeline event.`,
        });
      }
    }

    if (!evidence.title.trim() || !evidence.sourceLabel.trim()) {
      issues.push({
        code: "EMPTY_EVIDENCE_FIELD",
        message: "Evidence must have a title and source label.",
      });
    }

    if (evidence.occurredAt && Number.isNaN(evidence.occurredAt.getTime())) {
      issues.push({
        code: "INVALID_EVIDENCE_TIME",
        message: `Evidence "${evidence.title}" has an invalid timestamp.`,
      });
    }

    if (
      culprit &&
      (namesPerson(evidence.title, culprit.displayName) ||
        namesPerson(evidence.sourceLabel, culprit.displayName) ||
        (evidence.mediaUrl && namesPerson(evidence.mediaUrl, culprit.displayName)))
    ) {
      issues.push({
        code: "EVIDENCE_METADATA_NAMES_CULPRIT",
        message: `Evidence metadata for "${evidence.title}" names the culprit before the reveal.`,
      });
    }

    if (evidence.type === "image" && evidence.mediaStatus === "ready") {
      if (!evidence.mediaUrl) {
        issues.push({
          code: "MISSING_MEDIA_URL",
          message: `Image evidence "${evidence.title}" is marked ready without a media URL.`,
        });
      }
    }
  }

  const supportingIds = [...solutionDoc.supportingEvidenceIds];
  if (supportingIds.length < MIN_SUPPORTING_EVIDENCE) {
    issues.push({
      code: "INSUFFICIENT_SUPPORTING_EVIDENCE",
      message: `A solution must reference at least ${MIN_SUPPORTING_EVIDENCE} supporting evidence items.`,
    });
  }
  const supportingTypes = new Set<string>();
  let culpritLinkedSupporting = 0;
  for (const supportingId of supportingIds) {
    const evidence = evidenceById.get(supportingId);
    if (!evidence) {
      issues.push({
        code: "UNKNOWN_SUPPORTING_EVIDENCE",
        message: "The solution references evidence that is not part of the case.",
      });
      continue;
    }
    supportingTypes.add(evidence.type);
    if (culprit && evidence.relatedSuspectIds.some((id) => id === culprit._id)) {
      culpritLinkedSupporting += 1;
    }
  }
  if (supportingTypes.size < 2) {
    issues.push({
      code: "NON_INDEPENDENT_CLUES",
      message: "Supporting clues must include at least two independent evidence types.",
    });
  }
  if (culpritLinkedSupporting < MIN_SUPPORTING_EVIDENCE) {
    issues.push({
      code: "CLUES_DO_NOT_SUPPORT_CULPRIT",
      message: "At least two supporting clues must explicitly reference the culprit.",
    });
  }

  if (!solutionDoc.motive.trim() || !solutionDoc.method.trim() || !solutionDoc.explanation.trim()) {
    issues.push({
      code: "INCOMPLETE_SOLUTION",
      message: "The solution must include a motive, method, and explanation.",
    });
  }

  if (solutionDoc.hintTexts.length === 0) {
    issues.push({ code: "NO_HINTS", message: "A case must include at least one hint." });
  }
  const normalizedHints = new Set<string>();
  for (const hint of solutionDoc.hintTexts) {
    const normalized = hint.trim().toLowerCase();
    if (!normalized) {
      issues.push({ code: "EMPTY_HINT", message: "Hints must not be empty." });
    }
    if (normalizedHints.has(normalized)) {
      issues.push({ code: "DUPLICATE_HINT", message: "Hints must be unique." });
    }
    normalizedHints.add(normalized);
    if (culprit && namesPerson(hint, culprit.displayName)) {
      issues.push({
        code: "HINT_NAMES_CULPRIT",
        message: "A hint names the culprit instead of revealing reasoning progressively.",
      });
    }
  }

  if (!caseDoc.title.trim() || !caseDoc.fictionNotice.trim()) {
    issues.push({
      code: "INCOMPLETE_PUBLIC_CASE",
      message: "The case must have a title and a fiction notice.",
    });
  }

  if (!caseDoc.incident.location.trim() || !caseDoc.incident.description.trim()) {
    issues.push({
      code: "INCOMPLETE_INCIDENT",
      message: "The case must have complete incident details.",
    });
  }

  return { valid: issues.length === 0, issues };
}

function namesPerson(value: string, displayName: string): boolean {
  const fullName = displayName.trim();
  if (!fullName) {
    return false;
  }
  if (containsWord(value, fullName)) {
    return true;
  }
  const surname = fullName.split(/\s+/).filter((part) => part.length >= 4).at(-1);
  return surname ? containsWord(value, surname) : false;
}

function containsWord(value: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(value);
}
