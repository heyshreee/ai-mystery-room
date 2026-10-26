import { Types } from "mongoose";
import {
  FICTION_NOTICE,
  type EvidenceContent,
} from "@amr/shared";
import type { CaseDocument } from "../models/Case.js";
import type { EvidenceDocument } from "../models/Evidence.js";
import type { SolutionDocument } from "../models/Solution.js";
import type { SuspectDocument } from "../models/Suspect.js";
import type { CaseBlueprint } from "./blueprint.js";
import { PROMPT_VERSION } from "./prompt.js";
import { STATIC_EVIDENCE_DIAGRAM } from "./media.js";
import type { GenerationRequest } from "./types.js";

export interface BuildGeneratedCaseInput {
  blueprint: CaseBlueprint;
  request: GenerationRequest;
  caseId: Types.ObjectId;
  generationId: Types.ObjectId;
  creatorSessionId: string;
  provider: string;
  hintLimit: number;
}

export interface GeneratedCaseDocuments {
  caseDoc: Omit<CaseDocument, "createdAt" | "updatedAt">;
  suspectDocs: Array<Omit<SuspectDocument, "createdAt" | "updatedAt">>;
  evidenceDocs: Array<Omit<EvidenceDocument, "createdAt" | "updatedAt">>;
  solutionDoc: Omit<SolutionDocument, "createdAt" | "updatedAt">;
}

export function buildGeneratedCaseDocuments(
  input: BuildGeneratedCaseInput,
): GeneratedCaseDocuments {
  const { blueprint, request, caseId, generationId, creatorSessionId, provider } = input;
  const suspectIds = new Map<string, Types.ObjectId>();
  const evidenceIds = new Map<string, Types.ObjectId>();

  for (const suspect of blueprint.suspects) {
    suspectIds.set(suspect.key, new Types.ObjectId());
  }
  for (const evidence of blueprint.evidence) {
    evidenceIds.set(evidence.key, new Types.ObjectId());
  }

  const suspectDocs: GeneratedCaseDocuments["suspectDocs"] = blueprint.suspects.map(
    (suspect) => ({
      _id: required(suspectIds.get(suspect.key), `suspect ${suspect.key}`),
      caseId,
      displayName: suspect.displayName,
      role: suspect.role,
      profile: suspect.profile,
      motiveSummary: suspect.motiveSummary,
      opportunitySummary: suspect.opportunitySummary,
      publicStatement: suspect.publicStatement,
      relationships: suspect.relationships.map((relationship) => ({
        otherSuspectId: required(
          suspectIds.get(relationship.suspectKey),
          `relationship suspect ${relationship.suspectKey}`,
        ),
        relationship: relationship.relationship,
      })),
    }),
  );

  const evidenceDocs: GeneratedCaseDocuments["evidenceDocs"] = blueprint.evidence.map(
    (evidence, index) => {
      const content = mapEvidenceContent(evidence);
      const image = evidence.type === "image";
      return {
        _id: required(evidenceIds.get(evidence.key), `evidence ${evidence.key}`),
        caseId,
        exhibitNumber: index + 1,
        type: evidence.type,
        title: evidence.title,
        publicDescription: evidence.publicDescription,
        content,
        occurredAt: evidence.occurredAt ? new Date(evidence.occurredAt) : null,
        sourceLabel: evidence.sourceLabel,
        reliability: evidence.reliability,
        relatedSuspectIds: evidence.relatedSuspectKeys.map((key) =>
          required(suspectIds.get(key), `evidence suspect ${key}`),
        ),
        relatedTimelineEventIds: [...evidence.relatedTimelineEventIds],
        mediaStatus: image ? "ready" : "not_required",
        ...(image
          ? {
              mediaUrl: STATIC_EVIDENCE_DIAGRAM.url,
              altText:
                evidence.content.format === "image" && evidence.content.altText
                  ? evidence.content.altText
                  : STATIC_EVIDENCE_DIAGRAM.altText,
            }
          : {}),
      };
    },
  );

  const supportingEvidence = blueprint.supportingEvidenceKeys.map((key) => {
    const evidence = blueprint.evidence.find((entry) => entry.key === key);
    if (!evidence) {
      throw new Error(`Generated blueprint is missing supporting evidence "${key}".`);
    }
    const doc = evidenceDocs.find((entry) => entry._id.equals(required(evidenceIds.get(key), key)));
    if (!doc) {
      throw new Error(`Generated blueprint could not map supporting evidence "${key}".`);
    }
    return doc;
  });
  const supportingExhibitList = supportingEvidence
    .map((evidence) => `EXH-${String(evidence.exhibitNumber).padStart(2, "0")} — ${evidence.title}`)
    .join("; ");

  const caseDoc: GeneratedCaseDocuments["caseDoc"] = {
    _id: caseId,
    title: blueprint.title,
    scenario: request.scenario,
    summary: blueprint.summary,
    category: request.category,
    difficulty: request.difficulty,
    status: "validating",
    creatorSessionId,
    suspectIds: suspectDocs.map((suspect) => suspect._id),
    evidenceIds: evidenceDocs.map((evidence) => evidence._id),
    generationVersion: `${provider}:${PROMPT_VERSION}`,
    generationId,
    isSample: false,
    isPublic: false,
    incident: { ...blueprint.incident },
    timezone: blueprint.timezone,
    caseRules: [...blueprint.caseRules],
    fictionNotice: FICTION_NOTICE,
    timeline: blueprint.publicTimeline.map((event) => ({ ...event })),
  };

  const canonicalTimeline = blueprint.canonicalTimeline.map((event) => ({
    eventId: event.eventId,
    at: event.at,
    location: event.location,
    description: event.description,
    involvedSuspectIds: event.involvedSuspectKeys.map((key) =>
      required(suspectIds.get(key), `canonical event suspect ${key}`),
    ),
  }));

  const solutionDoc: GeneratedCaseDocuments["solutionDoc"] = {
    _id: new Types.ObjectId(),
    caseId,
    culpritSuspectId: required(
      suspectIds.get(blueprint.culpritKey),
      "canonical culprit",
    ),
    canonicalTimeline,
    motive: blueprint.motive,
    method: blueprint.method,
    explanation: `${blueprint.explanation}\n\nSupporting exhibits: ${supportingExhibitList}.`,
    supportingEvidenceIds: supportingEvidence.map((evidence) => evidence._id),
    hintTexts: blueprint.hintTexts.slice(0, input.hintLimit),
    validationStatus: "pending",
    contentSafetyFlags: [
      ...new Set([
        ...blueprint.contentSafetyFlags,
        "fictional_generated_case",
        "simulated_media",
      ]),
    ],
  };

  return { caseDoc, suspectDocs, evidenceDocs, solutionDoc };
}

function mapEvidenceContent(
  evidence: CaseBlueprint["evidence"][number],
): EvidenceContent {
  switch (evidence.content.format) {
    case "image":
      return {
        format: "image",
        imageUrl: STATIC_EVIDENCE_DIAGRAM.url,
        caption: evidence.content.caption,
        interpretation: evidence.content.interpretation,
        simulated: true,
      };
    case "chat":
      return {
        format: "chat",
        channel: evidence.content.channel,
        participants: [...evidence.content.participants],
        messages: evidence.content.messages.map((message) => ({ ...message })),
      };
    case "log":
      return {
        format: "log",
        entries: evidence.content.entries.map((entry) => ({ ...entry })),
      };
    case "statement":
      return {
        format: "statement",
        speaker: evidence.content.speaker,
        statement: evidence.content.statement,
        ...(evidence.content.recordedAt
          ? { recordedAt: evidence.content.recordedAt }
          : {}),
        ...(evidence.content.context ? { context: evidence.content.context } : {}),
      };
    case "document":
      return {
        format: "document",
        heading: evidence.content.heading,
        sections: evidence.content.sections.map((section) => ({
          heading: section.heading,
          body: [...section.body],
        })),
        ...(evidence.content.annotations
          ? { annotations: [...evidence.content.annotations] }
          : {}),
      };
    case "transcript":
      return {
        format: "transcript",
        source: evidence.content.source,
        lines: evidence.content.lines.map((line) => ({ ...line })),
      };
    case "generic":
      return { format: "generic", body: [...evidence.content.body] };
  }
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Generated case is missing ${label}.`);
  }
  return value;
}
