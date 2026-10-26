import { Schema, model, type Types } from "mongoose";

export interface SuspectRelationship {
  otherSuspectId: Types.ObjectId;
  relationship: string;
}

export interface SuspectDocument {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
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

const relationshipSchema = new Schema<SuspectRelationship>(
  {
    otherSuspectId: { type: Schema.Types.ObjectId, ref: "Suspect", required: true },
    relationship: { type: String, required: true },
  },
  { _id: false },
);

const suspectSchema = new Schema<SuspectDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    profile: { type: String, required: true },
    motiveSummary: { type: String, required: true },
    opportunitySummary: { type: String, required: true },
    publicStatement: { type: String, required: true },
    relationships: { type: [relationshipSchema], required: true, default: [] },
  },
  { timestamps: true },
);

suspectSchema.index({ caseId: 1 });

export const SuspectModel = model<SuspectDocument>("Suspect", suspectSchema);
