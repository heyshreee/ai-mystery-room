import type { ScoreBreakdown, SessionStatus } from "@amr/shared";

export interface GameSessionDocument {
  _id: string;
  caseId: string;
  guestTokenHash: string;
  status: SessionStatus;
  viewedEvidenceIds: string[];
  hintsUsed: number;
  accusationSuspectId?: string;
  isCorrect?: boolean;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  startedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
