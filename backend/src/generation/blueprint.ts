import { z } from "zod";
import {
  CATEGORY_VALUES,
  DIFFICULTY_VALUES,
  EVIDENCE_TYPE_VALUES,
  MAX_SUSPECTS,
  MIN_SUSPECTS,
} from "@amr/shared";

/**
 * The provider-facing case contract. Providers may return any JSON, so every
 * field is validated here before it can reach the database or a player.
 */

const isoTimestamp = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
    "Use an ISO 8601 timestamp with a UTC offset, for example 2026-10-17T21:47:00-04:00.",
  );

const keySchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "Keys must start with a lowercase letter and contain lowercase letters, numbers, underscores, or dashes.",
  );

const eventIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(
    /^[A-Za-z][A-Za-z0-9_-]*$/,
    "Event IDs must start with a letter and contain only letters, numbers, underscores, or dashes.",
  );

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional();

const chatContentSchema = z.strictObject({
  format: z.literal("chat"),
  channel: text(120, "Chat channel"),
  participants: z.array(text(80, "Chat participant")).min(1).max(12),
  messages: z
    .array(
      z.strictObject({
        at: text(24, "Message time"),
        sender: text(80, "Message sender"),
        text: text(1_500, "Message text"),
        system: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(40),
});

const logContentSchema = z.strictObject({
  format: z.literal("log"),
  entries: z
    .array(
      z.strictObject({
        at: text(24, "Log time"),
        actor: optionalText(100, "Log actor"),
        action: text(240, "Log action"),
        location: optionalText(120, "Log location"),
        note: optionalText(300, "Log note"),
      }),
    )
    .min(1)
    .max(40),
});

const statementContentSchema = z.strictObject({
  format: z.literal("statement"),
  speaker: text(120, "Statement speaker"),
  recordedAt: optionalText(24, "Statement time"),
  statement: text(4_000, "Statement"),
  context: optionalText(300, "Statement context"),
});

const documentContentSchema = z.strictObject({
  format: z.literal("document"),
  heading: optionalText(160, "Document heading"),
  sections: z
    .array(
      z.strictObject({
        heading: optionalText(160, "Document section heading"),
        body: z.array(text(1_000, "Document paragraph")).min(1).max(12),
      }),
    )
    .min(1)
    .max(8),
  annotations: z.array(text(300, "Document annotation")).max(8).optional(),
});

const imageContentSchema = z.strictObject({
  format: z.literal("image"),
  caption: text(300, "Image caption"),
  interpretation: text(1_000, "Image interpretation"),
  altText: optionalText(500, "Image alternative text"),
});

const transcriptContentSchema = z.strictObject({
  format: z.literal("transcript"),
  source: text(160, "Transcript source"),
  lines: z
    .array(
      z.strictObject({
        at: optionalText(24, "Transcript line time"),
        speaker: text(100, "Transcript speaker"),
        text: text(1_500, "Transcript line"),
      }),
    )
    .min(1)
    .max(40),
});

const genericContentSchema = z.strictObject({
  format: z.literal("generic"),
  body: z.array(text(1_500, "Exhibit paragraph")).min(1).max(12),
});

export const generatedEvidenceContentSchema = z.union([
  chatContentSchema,
  logContentSchema,
  statementContentSchema,
  documentContentSchema,
  imageContentSchema,
  transcriptContentSchema,
  genericContentSchema,
]);

const evidenceTypeSchema = z.enum(EVIDENCE_TYPE_VALUES);

const evidenceSchema = z
  .strictObject({
    key: keySchema,
    type: evidenceTypeSchema,
    title: text(180, "Evidence title"),
    publicDescription: text(800, "Evidence description"),
    content: generatedEvidenceContentSchema,
    occurredAt: isoTimestamp.optional(),
    sourceLabel: text(220, "Evidence source"),
    reliability: z.enum(["low", "medium", "high", "unknown"]),
    relatedSuspectKeys: z.array(keySchema).max(MAX_SUSPECTS),
    relatedTimelineEventIds: z.array(eventIdSchema).min(1).max(12),
  })
  .superRefine((evidence, context) => {
    const expectedFormat: Record<string, string> = {
      chat_transcript: "chat",
      cctv_log: "log",
      access_log: "log",
      cctv_transcript: "transcript",
      witness_statement: "statement",
      suspect_statement: "statement",
      document: "document",
      image: "image",
      timeline_event: "generic",
    };
    const expected = expectedFormat[evidence.type];
    if (expected && evidence.content.format !== expected) {
      context.addIssue({
        code: "custom",
        path: ["content", "format"],
        message: `Evidence type "${evidence.type}" must use content format "${expected}".`,
      });
    }
  });

const relationshipSchema = z.strictObject({
  suspectKey: keySchema,
  relationship: text(300, "Relationship"),
});

const suspectSchema = z.strictObject({
  key: keySchema,
  displayName: text(90, "Suspect name"),
  role: text(120, "Suspect role"),
  profile: text(1_200, "Suspect profile"),
  motiveSummary: text(900, "Suspect motive"),
  opportunitySummary: text(900, "Suspect opportunity"),
  publicStatement: text(1_500, "Suspect statement"),
  relationships: z.array(relationshipSchema).max(MAX_SUSPECTS),
});

const publicTimelineEventSchema = z.strictObject({
  eventId: eventIdSchema,
  at: isoTimestamp,
  location: text(160, "Timeline location"),
  description: text(800, "Timeline description"),
});

const canonicalTimelineEventSchema = z.strictObject({
  eventId: eventIdSchema,
  at: isoTimestamp,
  location: text(160, "Canonical timeline location"),
  description: text(800, "Canonical timeline description"),
  involvedSuspectKeys: z.array(keySchema).min(0).max(MAX_SUSPECTS),
});

const blueprintBaseSchema = z.strictObject({
  title: text(180, "Case title"),
  summary: text(1_500, "Case summary"),
  category: z.enum(CATEGORY_VALUES),
  difficulty: z.enum(DIFFICULTY_VALUES),
  timezone: text(80, "Timezone").regex(
    /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/,
    "Use an IANA timezone such as America/New_York or UTC.",
  ),
  incident: z.strictObject({
    location: text(180, "Incident location"),
    occurredAt: isoTimestamp,
    description: text(1_200, "Incident description"),
  }),
  caseRules: z.array(text(400, "Case rule")).min(1).max(8),
  suspects: z.array(suspectSchema).min(MIN_SUSPECTS).max(MAX_SUSPECTS),
  publicTimeline: z.array(publicTimelineEventSchema).min(5).max(20),
  canonicalTimeline: z.array(canonicalTimelineEventSchema).min(5).max(20),
  evidence: z.array(evidenceSchema).min(4).max(14),
  culpritKey: keySchema,
  motive: text(1_500, "Solution motive"),
  method: text(1_800, "Solution method"),
  explanation: text(5_000, "Solution explanation"),
  supportingEvidenceKeys: z.array(keySchema).min(2).max(12),
  hintTexts: z.array(text(1_000, "Hint")).min(1).max(6),
  contentSafetyFlags: z.array(text(100, "Content safety flag")).max(12),
});

export const caseBlueprintSchema = blueprintBaseSchema.superRefine(
  (blueprint, context) => {
    const suspectKeys = new Set<string>();
    const displayNames = new Set<string>();
    for (const suspect of blueprint.suspects) {
      if (suspectKeys.has(suspect.key)) {
        context.addIssue({
          code: "custom",
          path: ["suspects"],
          message: `Suspect key "${suspect.key}" is duplicated.`,
        });
      }
      suspectKeys.add(suspect.key);

      const normalizedName = suspect.displayName.toLowerCase();
      if (displayNames.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          path: ["suspects"],
          message: `Suspect name "${suspect.displayName}" is duplicated.`,
        });
      }
      displayNames.add(normalizedName);

      for (const relationship of suspect.relationships) {
        if (relationship.suspectKey === suspect.key) {
          context.addIssue({
            code: "custom",
            path: ["suspects"],
            message: `${suspect.displayName} cannot have a relationship with themself.`,
          });
        }
      }
    }
    for (const suspect of blueprint.suspects) {
      for (const relationship of suspect.relationships) {
        if (
          !suspectKeys.has(relationship.suspectKey) &&
          relationship.suspectKey !== suspect.key
        ) {
          context.addIssue({
            code: "custom",
            path: ["suspects"],
            message: `${suspect.displayName} references an unknown suspect "${relationship.suspectKey}".`,
          });
        }
      }
    }

    if (!suspectKeys.has(blueprint.culpritKey)) {
      context.addIssue({
        code: "custom",
        path: ["culpritKey"],
        message: "The culprit must be one of the listed suspects.",
      });
    }

    const publicEventIds = new Set<string>();
    let previousPublicTime = Number.NEGATIVE_INFINITY;
    for (const event of blueprint.publicTimeline) {
      if (publicEventIds.has(event.eventId)) {
        context.addIssue({
          code: "custom",
          path: ["publicTimeline"],
          message: `Timeline event "${event.eventId}" is duplicated.`,
        });
      }
      publicEventIds.add(event.eventId);
      const time = Date.parse(event.at);
      if (time < previousPublicTime) {
        context.addIssue({
          code: "custom",
          path: ["publicTimeline"],
          message: "Public timeline events must be in chronological order.",
        });
      }
      previousPublicTime = time;
    }

    const canonicalIds = new Set<string>();
    const publicById = new Map(
      blueprint.publicTimeline.map((event) => [event.eventId, event] as const),
    );
    let previousCanonicalTime = Number.NEGATIVE_INFINITY;
    for (const event of blueprint.canonicalTimeline) {
      if (canonicalIds.has(event.eventId)) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTimeline"],
          message: `Canonical event "${event.eventId}" is duplicated.`,
        });
      }
      canonicalIds.add(event.eventId);

      const publicEvent = publicById.get(event.eventId);
      if (!publicEvent) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTimeline"],
          message: `Canonical event "${event.eventId}" is missing from the public timeline.`,
        });
      } else if (
        publicEvent.at !== event.at ||
        publicEvent.location !== event.location
      ) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTimeline"],
          message: `Canonical event "${event.eventId}" must use the same time and location as its public event.`,
        });
      }

      for (const suspectKey of event.involvedSuspectKeys) {
        if (!suspectKeys.has(suspectKey)) {
          context.addIssue({
            code: "custom",
            path: ["canonicalTimeline"],
            message: `Canonical event "${event.eventId}" references an unknown suspect.`,
          });
        }
      }

      const time = Date.parse(event.at);
      if (time < previousCanonicalTime) {
        context.addIssue({
          code: "custom",
          path: ["canonicalTimeline"],
          message: "Canonical timeline events must be in chronological order.",
        });
      }
      previousCanonicalTime = time;
    }

    const evidenceKeys = new Set<string>();
    for (const evidence of blueprint.evidence) {
      if (evidenceKeys.has(evidence.key)) {
        context.addIssue({
          code: "custom",
          path: ["evidence"],
          message: `Evidence key "${evidence.key}" is duplicated.`,
        });
      }
      evidenceKeys.add(evidence.key);

      for (const suspectKey of evidence.relatedSuspectKeys) {
        if (!suspectKeys.has(suspectKey)) {
          context.addIssue({
            code: "custom",
            path: ["evidence"],
            message: `Evidence "${evidence.title}" references an unknown suspect.`,
          });
        }
      }
      for (const eventId of evidence.relatedTimelineEventIds) {
        if (!publicEventIds.has(eventId)) {
          context.addIssue({
            code: "custom",
            path: ["evidence"],
            message: `Evidence "${evidence.title}" references an unknown timeline event.`,
          });
        }
      }
    }

    if (blueprint.supportingEvidenceKeys.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["supportingEvidenceKeys"],
        message: "At least two supporting evidence items are required.",
      });
    }
    let culpritLinkedSupporting = 0;
    const supportingTypes = new Set<string>();
    for (const evidenceKey of blueprint.supportingEvidenceKeys) {
      const evidence = blueprint.evidence.find((entry) => entry.key === evidenceKey);
      if (!evidence) {
        context.addIssue({
          code: "custom",
          path: ["supportingEvidenceKeys"],
          message: `Supporting evidence "${evidenceKey}" is not part of the case.`,
        });
        continue;
      }
      supportingTypes.add(evidence.type);
      if (evidence.relatedSuspectKeys.includes(blueprint.culpritKey)) {
        culpritLinkedSupporting += 1;
      }
    }
    if (supportingTypes.size < 2) {
      context.addIssue({
        code: "custom",
        path: ["supportingEvidenceKeys"],
        message: "Supporting evidence must include at least two independent types.",
      });
    }
    if (culpritLinkedSupporting < 2) {
      context.addIssue({
        code: "custom",
        path: ["supportingEvidenceKeys"],
        message: "At least two supporting clues must reference the culprit.",
      });
    }

    if (blueprint.canonicalTimeline.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["canonicalTimeline"],
        message: "A canonical timeline is required.",
      });
    }
  },
);

export type CaseBlueprint = z.infer<typeof caseBlueprintSchema>;
export type BlueprintEvidence = CaseBlueprint["evidence"][number];
export type BlueprintSuspect = CaseBlueprint["suspects"][number];

export function parseCaseBlueprint(value: unknown): CaseBlueprint {
  return caseBlueprintSchema.parse(value);
}
