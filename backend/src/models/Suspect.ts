export interface SuspectRelationship {
  otherSuspectId: string;
  relationship: string;
}

export interface SuspectDocument {
  _id: string;
  caseId: string;
  displayName: string;
  role: string;
  profile: string;
  motiveSummary: string;
  opportunitySummary: string;
  publicStatement: string;
  relationships: SuspectRelationship[];
  createdAt?: Date;
  updatedAt?: Date;
}
