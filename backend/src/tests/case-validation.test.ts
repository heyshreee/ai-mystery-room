import { describe, expect, it } from "vitest";
import { instantiateSampleCase } from "../services/sample-case.js";
import { validateCaseStructure } from "../services/case-validation.js";

function sample() {
  return instantiateSampleCase();
}

describe("deterministic case validation", () => {
  it("accepts the hand-authored sample case", () => {
    const result = validateCaseStructure(sample());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects a culprit who is not in the suspect list", () => {
    const input = sample();
    input.suspectDocs = input.suspectDocs.filter(
      (suspect) => suspect._id !== input.solutionDoc.culpritSuspectId,
    );
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("CULPRIT_NOT_IN_CASE");
  });

  it("requires at least two supporting evidence items", () => {
    const input = sample();
    input.solutionDoc.supportingEvidenceIds = input.solutionDoc.supportingEvidenceIds.slice(0, 1);
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "INSUFFICIENT_SUPPORTING_EVIDENCE",
    );
  });

  it("rejects evidence that references an unknown timeline event", () => {
    const input = sample();
    const firstEvidence = input.evidenceDocs[0];
    if (!firstEvidence) {
      throw new Error("fixture missing evidence");
    }
    firstEvidence.relatedTimelineEventIds = ["evt-does-not-exist"];
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("INVALID_EVIDENCE_EVENT");
  });

  it("rejects a public timeline that is out of order", () => {
    const input = sample();
    input.caseDoc.timeline = [...input.caseDoc.timeline].reverse();
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("TIMELINE_OUT_OF_ORDER");
  });

  it("rejects evidence metadata that names the culprit", () => {
    const input = sample();
    const culprit = input.suspectDocs.find((suspect) =>
      suspect._id === input.solutionDoc.culpritSuspectId,
    );
    const firstEvidence = input.evidenceDocs[0];
    if (!culprit || !firstEvidence) {
      throw new Error("fixture missing required record");
    }
    firstEvidence.title = `Statement from ${culprit.displayName}`;
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "EVIDENCE_METADATA_NAMES_CULPRIT",
    );
  });

  it("rejects a hint that names the culprit", () => {
    const input = sample();
    const culprit = input.suspectDocs.find((suspect) =>
      suspect._id === input.solutionDoc.culpritSuspectId,
    );
    if (!culprit) {
      throw new Error("fixture missing culprit");
    }
    input.solutionDoc.hintTexts[0] = `${culprit.displayName} opened the door.`;
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("HINT_NAMES_CULPRIT");
  });

  it("rejects a canonical event that is not in the public timeline", () => {
    const input = sample();
    const firstCanonical = input.solutionDoc.canonicalTimeline[0];
    if (!firstCanonical) {
      throw new Error("fixture missing canonical timeline");
    }
    firstCanonical.eventId = "evt-hidden-event";
    const result = validateCaseStructure(input);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "CANONICAL_EVENT_NOT_PUBLIC",
    );
  });
});
