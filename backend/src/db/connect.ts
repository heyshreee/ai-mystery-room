import mongoose from "mongoose";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { CaseModel } from "../models/Case.js";
import { EvidenceModel } from "../models/Evidence.js";
import { GameSessionModel } from "../models/GameSession.js";
import { GenerationJobModel } from "../models/GenerationJob.js";
import { SolutionModel } from "../models/Solution.js";
import { SuspectModel } from "../models/Suspect.js";

export async function connectDatabase(config: AppConfig, logger: Logger): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  await Promise.all([
    CaseModel.init(),
    SuspectModel.init(),
    EvidenceModel.init(),
    SolutionModel.init(),
    GameSessionModel.init(),
    GenerationJobModel.init(),
  ]);

  const connection = mongoose.connection;
  logger.info(
    {
      host: connection.host,
      database: connection.name,
    },
    "MongoDB connected and indexes initialized",
  );
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
