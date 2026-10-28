export type GenerationStatus = "pending" | "validating" | "ready" | "failed";

export interface GenerationJobDocument {
  _id: string;
  caseId: string;
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
