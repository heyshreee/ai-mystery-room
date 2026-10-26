import { Schema, model, type Types } from "mongoose";
import type {
  Category,
  Difficulty,
  PublicTimelineEvent,
} from "@amr/shared";

export type CaseStatus = "generating" | "validating" | "ready" | "failed";

export interface CaseIncident {
  location: string;
  occurredAt: string;
  description: string;
}

export interface CaseDocument {
  _id: Types.ObjectId;
  title: string;
  scenario: string;
  summary: string;
  category: Category;
  difficulty: Difficulty;
  status: CaseStatus;
  creatorSessionId: string;
  suspectIds: Types.ObjectId[];
  evidenceIds: Types.ObjectId[];
  generationVersion: string;
  generationId: Types.ObjectId;
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

const incidentSchema = new Schema<CaseIncident>(
  {
    location: { type: String, required: true, trim: true },
    occurredAt: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false },
);

const timelineEventSchema = new Schema<PublicTimelineEvent>(
  {
    eventId: { type: String, required: true },
    at: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false },
);

const caseSchema = new Schema<CaseDocument>(
  {
    title: { type: String, required: true, trim: true },
    scenario: { type: String, required: true },
    summary: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["theft", "missing_person", "fraud", "sabotage", "other"],
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    status: {
      type: String,
      required: true,
      enum: ["generating", "validating", "ready", "failed"],
      default: "generating",
    },
    creatorSessionId: { type: String, required: true },
    suspectIds: [{ type: Schema.Types.ObjectId, ref: "Suspect", required: true }],
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence", required: true }],
    generationVersion: { type: String, required: true },
    generationId: { type: Schema.Types.ObjectId, ref: "GenerationJob", required: true },
    idempotencyKey: { type: String, required: false },
    isSample: { type: Boolean, required: true, default: false },
    isPublic: { type: Boolean, required: true, default: false },
    incident: { type: incidentSchema, required: true },
    timezone: { type: String, required: true },
    caseRules: { type: [String], required: true, default: [] },
    fictionNotice: { type: String, required: true },
    timeline: { type: [timelineEventSchema], required: true, default: [] },
  },
  { timestamps: true },
);

caseSchema.index({ status: 1, createdAt: -1 });
caseSchema.index(
  { creatorSessionId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
caseSchema.index({ generationId: 1 }, { unique: true });

export const CaseModel = model<CaseDocument>("Case", caseSchema);
