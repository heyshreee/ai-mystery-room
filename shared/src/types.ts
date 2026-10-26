import type {
  Category,
  Difficulty,
  EvidencePreference,
  EvidenceType,
  MediaStatus,
  Reliability,
  SessionStatus,
} from "./constants.js";

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "CASE_NOT_FOUND"
  | "CASE_NOT_READY"
  | "GENERATION_FAILED"
  | "GENERATION_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "INVALID_AI_OUTPUT"
  | "SESSION_NOT_FOUND"
  | "SESSION_EXPIRED"
  | "SESSION_COMPLETED"
  | "RESULT_NOT_AVAILABLE"
  | "EVIDENCE_NOT_FOUND"
  | "SUSPECT_NOT_FOUND"
  | "HINT_LIMIT_REACHED"
  | "INVALID_ACCUSATION"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export interface PublicTimelineEvent {
  eventId: string;
  at: string;
  location: string;
  description: string;
}

export interface IncidentView {
  location: string;
  occurredAt: string;
  description: string;
}

export interface SuspectRelationshipView {
  suspectId: string;
  displayName: string;
  relationship: string;
}

export interface SuspectView {
  id: string;
  displayName: string;
  role: string;
  profile: string;
  motiveSummary: string;
  opportunitySummary: string;
  publicStatement: string;
  relationships: SuspectRelationshipView[];
}

export interface PublicCase {
  id: string;
  title: string;
  summary: string;
  category: Category;
  difficulty: Difficulty;
  status: "ready";
  incident: IncidentView;
  timezone: string;
  caseRules: string[];
  timeline: PublicTimelineEvent[];
  suspects: SuspectView[];
  evidenceCount: number;
  isSample: boolean;
  fictionNotice: string;
  createdAt: string;
}

export type EvidenceContent =
  | {
      format: "chat";
      channel: string;
      participants: string[];
      messages: Array<{
        at: string;
        sender: string;
        text: string;
        system?: boolean;
      }>;
    }
  | {
      format: "log";
      entries: Array<{
        at: string;
        actor?: string;
        action: string;
        location?: string;
        note?: string;
      }>;
    }
  | {
      format: "statement";
      speaker: string;
      recordedAt?: string;
      statement: string;
      context?: string;
    }
  | {
      format: "document";
      heading?: string;
      sections: Array<{ heading?: string; body: string[] }>;
      annotations?: string[];
    }
  | {
      format: "image";
      imageUrl: string;
      caption: string;
      interpretation: string;
      simulated: true;
    }
  | {
      format: "transcript";
      source: string;
      lines: Array<{ at?: string; speaker: string; text: string }>;
    }
  | {
      format: "generic";
      body: string[];
    };

export interface EvidenceSummary {
  id: string;
  caseId: string;
  exhibitNumber: number;
  type: EvidenceType;
  title: string;
  publicDescription: string;
  occurredAt: string | null;
  sourceLabel: string;
  reliability: Reliability;
  relatedSuspectIds: string[];
  relatedTimelineEventIds: string[];
  mediaStatus: MediaStatus;
  mediaUrl?: string;
  altText?: string;
}

export interface EvidenceDetail extends EvidenceSummary {
  content: EvidenceContent;
  fictionNotice: string;
}

export interface GameSessionView {
  id: string;
  caseId: string;
  status: SessionStatus;
  viewedEvidenceIds: string[];
  hintsUsed: number;
  hintLimit: number;
  hintsRemaining: number;
  startedAt: string;
  expiresAt: string;
  completedAt?: string;
  resultsAvailable: boolean;
}

export interface HintView {
  hint: string;
  hintsUsed: number;
  hintLimit: number;
  hintsRemaining: number;
}

export interface ScoreBreakdown {
  base: number;
  hintPenalty: number;
  hintsUsed: number;
  total: number;
}

export interface ResultView {
  sessionId: string;
  caseId: string;
  correct: boolean;
  selectedSuspect: {
    id: string;
    displayName: string;
  };
  culprit: SuspectView;
  solution: {
    motive: string;
    method: string;
    explanation: string;
  };
  supportingEvidence: EvidenceSummary[];
  score: ScoreBreakdown;
  completedAt: string;
  fictionNotice: string;
}

export interface GenerationStatusView {
  id: string;
  caseId: string;
  status: "pending" | "validating" | "ready" | "failed";
  stage: string;
  provider: string;
  /** Safe player-facing status text. Never contains provider secrets or prompts. */
  message?: string;
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CaseCreatedView {
  case: PublicCase;
  generationId: string;
  sample: boolean;
}

export interface HealthView {
  status: "ok" | "degraded";
  service: "ai-mystery-room-api";
  version: string;
  database: "connected" | "disconnected";
  aiProvider: string;
  mediaProvider: string;
  timestamp: string;
}

export interface PaginationMeta {
  count: number;
}

export interface EvidenceListView {
  evidence: EvidenceSummary[];
  meta: PaginationMeta;
}

export type EvidencePreferenceValue = EvidencePreference;
