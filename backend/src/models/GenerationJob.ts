import { Schema, model, type Types } from "mongoose";

export type GenerationStatus = "pending" | "validating" | "ready" | "failed";

export interface GenerationJobDocument {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  creatorSessionId: string;
  status: GenerationStatus;
  stage: string;
  attempts: number;
  provider: string;
  promptVersion: string;
  errorCode?: string;
  message?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

const generationJobSchema = new Schema<GenerationJobDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    creatorSessionId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "validating", "ready", "failed"],
      default: "pending",
    },
    stage: { type: String, required: true, default: "accepted" },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    provider: { type: String, required: true },
    promptVersion: { type: String, required: true },
    errorCode: { type: String, required: false },
    message: { type: String, required: false },
    completedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

generationJobSchema.index({ caseId: 1 }, { unique: true });
generationJobSchema.index({ status: 1, createdAt: -1 });

export const GenerationJobModel = model<GenerationJobDocument>(
  "GenerationJob",
  generationJobSchema,
);
