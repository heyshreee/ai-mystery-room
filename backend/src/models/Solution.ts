export interface CanonicalTimelineEvent {
  eventId: string;
  at: string;
  location: string;
  description: string;
  involvedSuspectIds: string[];
}

export interface SolutionDocument {
  _id: string;
  caseId: string;
  culpritSuspectId: string;
  canonicalTimeline: CanonicalTimelineEvent[];
  motive: string;
  method: string;
  explanation: string;
  supportingEvidenceIds: string[];
  hintTexts: string[];
  validationStatus: "pending" | "valid" | "invalid";
  contentSafetyFlags: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
