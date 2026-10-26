import type {
  EvidenceDetail,
  EvidenceListView,
  EvidenceSummary,
  GameSessionView,
  GenerationStatusView,
  PublicCase,
  ResultView,
  SuspectView,
} from "@amr/shared";
import type { CaseDocument } from "../models/Case.js";
import type { EvidenceDocument } from "../models/Evidence.js";
import type { GameSessionDocument } from "../models/GameSession.js";
import type { GenerationJobDocument } from "../models/GenerationJob.js";
import type { SolutionDocument } from "../models/Solution.js";
import type { SuspectDocument } from "../models/Suspect.js";

function iso(value: Date | undefined | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toSuspectView(
  suspect: SuspectDocument,
  allSuspects: SuspectDocument[],
): SuspectView {
  const byId = new Map(allSuspects.map((entry) => [entry._id.toString(), entry] as const));
  return {
    id: suspect._id.toString(),
    displayName: suspect.displayName,
    role: suspect.role,
    profile: suspect.profile,
    motiveSummary: suspect.motiveSummary,
    opportunitySummary: suspect.opportunitySummary,
    publicStatement: suspect.publicStatement,
    relationships: suspect.relationships.map((relationship) => ({
      suspectId: relationship.otherSuspectId.toString(),
      displayName:
        byId.get(relationship.otherSuspectId.toString())?.displayName ?? "Unknown person",
      relationship: relationship.relationship,
    })),
  };
}

export function toPublicCase(
  caseDoc: CaseDocument,
  suspectDocs: SuspectDocument[],
  evidenceCount: number,
): PublicCase {
  const suspects = orderedSuspects(caseDoc, suspectDocs).map((suspect) =>
    toSuspectView(suspect, suspectDocs),
  );

  return {
    id: caseDoc._id.toString(),
    title: caseDoc.title,
    summary: caseDoc.summary,
    category: caseDoc.category,
    difficulty: caseDoc.difficulty,
    status: "ready",
    incident: {
      location: caseDoc.incident.location,
      occurredAt: caseDoc.incident.occurredAt,
      description: caseDoc.incident.description,
    },
    timezone: caseDoc.timezone,
    caseRules: [...caseDoc.caseRules],
    timeline: caseDoc.timeline.map((event) => ({
      eventId: event.eventId,
      at: event.at,
      location: event.location,
      description: event.description,
    })),
    suspects,
    evidenceCount,
    isSample: caseDoc.isSample,
    fictionNotice: caseDoc.fictionNotice,
    createdAt: iso(caseDoc.createdAt) ?? new Date(0).toISOString(),
  };
}

export function orderedSuspects(
  caseDoc: Pick<CaseDocument, "suspectIds">,
  suspectDocs: SuspectDocument[],
): SuspectDocument[] {
  const byId = new Map(suspectDocs.map((suspect) => [suspect._id.toString(), suspect] as const));
  return caseDoc.suspectIds
    .map((id) => byId.get(id.toString()))
    .filter((suspect): suspect is SuspectDocument => Boolean(suspect));
}

export function toEvidenceSummary(evidence: EvidenceDocument): EvidenceSummary {
  return {
    id: evidence._id.toString(),
    caseId: evidence.caseId.toString(),
    exhibitNumber: evidence.exhibitNumber,
    type: evidence.type,
    title: evidence.title,
    publicDescription: evidence.publicDescription,
    occurredAt: iso(evidence.occurredAt) ?? null,
    sourceLabel: evidence.sourceLabel,
    reliability: evidence.reliability,
    relatedSuspectIds: evidence.relatedSuspectIds.map((id) => id.toString()),
    relatedTimelineEventIds: [...evidence.relatedTimelineEventIds],
    mediaStatus: evidence.mediaStatus,
    ...(evidence.mediaUrl ? { mediaUrl: evidence.mediaUrl } : {}),
    ...(evidence.altText ? { altText: evidence.altText } : {}),
  };
}

export function toEvidenceDetail(
  evidence: EvidenceDocument,
  fictionNotice: string,
): EvidenceDetail {
  return {
    ...toEvidenceSummary(evidence),
    content: evidence.content,
    fictionNotice,
  };
}

export function toEvidenceListView(evidenceDocs: EvidenceDocument[]): EvidenceListView {
  return {
    evidence: evidenceDocs.map(toEvidenceSummary),
    meta: { count: evidenceDocs.length },
  };
}

export function toSessionView(
  session: GameSessionDocument,
  hintLimit: number,
): GameSessionView {
  return {
    id: session._id.toString(),
    caseId: session.caseId.toString(),
    status: session.status,
    viewedEvidenceIds: session.viewedEvidenceIds.map((id) => id.toString()),
    hintsUsed: session.hintsUsed,
    hintLimit,
    hintsRemaining: Math.max(0, hintLimit - session.hintsUsed),
    startedAt: session.startedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    ...(session.completedAt ? { completedAt: session.completedAt.toISOString() } : {}),
    resultsAvailable: session.status === "completed",
  };
}

export function toResultView(input: {
  session: GameSessionDocument;
  caseDoc: CaseDocument;
  solution: SolutionDocument;
  culprit: SuspectDocument;
  suspects: SuspectDocument[];
  selected: SuspectDocument;
  supportingEvidence: EvidenceDocument[];
}): ResultView {
  const { session, caseDoc, solution, culprit, suspects, selected, supportingEvidence } = input;

  const score = session.scoreBreakdown ?? {
    base: session.isCorrect ? 100 : 0,
    hintPenalty: 0,
    hintsUsed: session.hintsUsed,
    total: session.score ?? 0,
  };

  return {
    sessionId: session._id.toString(),
    caseId: caseDoc._id.toString(),
    correct: session.isCorrect === true,
    selectedSuspect: {
      id: selected._id.toString(),
      displayName: selected.displayName,
    },
    culprit: toSuspectView(culprit, suspects),
    solution: {
      motive: solution.motive,
      method: solution.method,
      explanation: solution.explanation,
    },
    supportingEvidence: supportingEvidence.map(toEvidenceSummary),
    score,
    completedAt:
      iso(session.completedAt) ?? new Date().toISOString(),
    fictionNotice: caseDoc.fictionNotice,
  };
}

export function toGenerationStatusView(job: GenerationJobDocument): GenerationStatusView {
  return {
    id: job._id.toString(),
    caseId: job.caseId.toString(),
    status: job.status,
    stage: job.stage,
    provider: job.provider,
    ...(job.errorCode ? { errorCode: job.errorCode } : {}),
    ...(job.message ? { message: job.message } : {}),
    createdAt: iso(job.createdAt) ?? new Date(0).toISOString(),
    ...(job.completedAt ? { completedAt: job.completedAt.toISOString() } : {}),
  };
}
