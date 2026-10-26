import { Schema, model, type Types } from "mongoose";
import type {
  EvidenceContent,
  EvidenceType,
  MediaStatus,
  Reliability,
} from "@amr/shared";

export interface EvidenceDocument {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  exhibitNumber: number;
  type: EvidenceType;
  title: string;
  publicDescription: string;
  content: EvidenceContent;
  occurredAt: Date | null;
  sourceLabel: string;
  reliability: Reliability;
  relatedSuspectIds: Types.ObjectId[];
  relatedTimelineEventIds: string[];
  mediaStatus: MediaStatus;
  mediaUrl?: string;
  altText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const evidenceSchema = new Schema<EvidenceDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    exhibitNumber: { type: Number, required: true, min: 1 },
    type: {
      type: String,
      required: true,
      enum: [
        "chat_transcript",
        "image",
        "cctv_log",
        "cctv_transcript",
        "witness_statement",
        "suspect_statement",
        "access_log",
        "document",
        "timeline_event",
      ],
    },
    title: { type: String, required: true, trim: true },
    publicDescription: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: false, default: null },
    sourceLabel: { type: String, required: true },
    reliability: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "unknown"],
    },
    relatedSuspectIds: [{ type: Schema.Types.ObjectId, ref: "Suspect", required: true }],
    relatedTimelineEventIds: { type: [String], required: true, default: [] },
    mediaStatus: {
      type: String,
      required: true,
      enum: ["not_required", "pending", "ready", "failed"],
      default: "not_required",
    },
    mediaUrl: { type: String, required: false },
    altText: { type: String, required: false },
  },
  { timestamps: true },
);

evidenceSchema.index({ caseId: 1, exhibitNumber: 1 }, { unique: true });
evidenceSchema.index({ caseId: 1, type: 1 });
evidenceSchema.index({ caseId: 1, occurredAt: 1 });

export const EvidenceModel = model<EvidenceDocument>("Evidence", evidenceSchema);
