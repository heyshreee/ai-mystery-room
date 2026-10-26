import { Schema, model, type Types } from "mongoose";

export interface CanonicalTimelineEvent {
  eventId: string;
  at: string;
  location: string;
  description: string;
  involvedSuspectIds: Types.ObjectId[];
}

export interface SolutionDocument {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  culpritSuspectId: Types.ObjectId;
  canonicalTimeline: CanonicalTimelineEvent[];
  motive: string;
  method: string;
  explanation: string;
  supportingEvidenceIds: Types.ObjectId[];
  hintTexts: string[];
  validationStatus: "pending" | "valid" | "invalid";
  contentSafetyFlags: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const canonicalTimelineSchema = new Schema<CanonicalTimelineEvent>(
  {
    eventId: { type: String, required: true },
    at: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String, required: true },
    involvedSuspectIds: [{ type: Schema.Types.ObjectId, ref: "Suspect", required: true }],
  },
  { _id: false },
);

const solutionSchema = new Schema<SolutionDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    culpritSuspectId: { type: Schema.Types.ObjectId, ref: "Suspect", required: true },
    canonicalTimeline: { type: [canonicalTimelineSchema], required: true },
    motive: { type: String, required: true },
    method: { type: String, required: true },
    explanation: { type: String, required: true },
    supportingEvidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence", required: true }],
    hintTexts: { type: [String], required: true },
    validationStatus: {
      type: String,
      required: true,
      enum: ["pending", "valid", "invalid"],
      default: "pending",
    },
    contentSafetyFlags: { type: [String], required: true, default: [] },
  },
  { timestamps: true },
);

solutionSchema.index({ caseId: 1 }, { unique: true });

export const SolutionModel = model<SolutionDocument>("Solution", solutionSchema);
