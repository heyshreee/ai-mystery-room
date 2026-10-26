import { Schema, model, type Types } from "mongoose";
import type { ScoreBreakdown, SessionStatus } from "@amr/shared";

export interface GameSessionDocument {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  guestTokenHash: string;
  status: SessionStatus;
  viewedEvidenceIds: Types.ObjectId[];
  hintsUsed: number;
  accusationSuspectId?: Types.ObjectId;
  isCorrect?: boolean;
  score?: number;
  scoreBreakdown?: ScoreBreakdown;
  startedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const scoreBreakdownSchema = new Schema<ScoreBreakdown>(
  {
    base: { type: Number, required: true },
    hintPenalty: { type: Number, required: true },
    hintsUsed: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false },
);

const gameSessionSchema = new Schema<GameSessionDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    guestTokenHash: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["investigating", "completed", "expired"],
      default: "investigating",
    },
    viewedEvidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence", required: true }],
    hintsUsed: { type: Number, required: true, min: 0, default: 0 },
    accusationSuspectId: { type: Schema.Types.ObjectId, ref: "Suspect", required: false },
    isCorrect: { type: Boolean, required: false },
    score: { type: Number, required: false, min: 0 },
    scoreBreakdown: { type: scoreBreakdownSchema, required: false },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, required: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

gameSessionSchema.index({ caseId: 1, expiresAt: 1 });
gameSessionSchema.index({ guestTokenHash: 1 });

export const GameSessionModel = model<GameSessionDocument>(
  "GameSession",
  gameSessionSchema,
);
