import type { Category, Difficulty, PublicTimelineEvent } from "@amr/shared";

export type CaseStatus = "generating" | "validating" | "ready" | "failed";

export interface CaseIncident {
  location: string;
  occurredAt: string;
  description: string;
}

export interface CaseDocument {
  _id: string;
  title: string;
  scenario: string;
  summary: string;
  category: Category;
  difficulty: Difficulty;
  status: CaseStatus;
  creatorSessionId: string;
  suspectIds: string[];
  evidenceIds: string[];
  generationVersion: string;
  generationId: string;
  idempotencyKey?: string;
  isSample: boolean;
  isPublic: boolean;
  incident: CaseIncident;
  timezone: string;
  caseRules: string[];
  fictionNotice: string;
  timeline: PublicTimelineEvent[];
  createdAt?: Date;
  updatedAt?: Date;
}
