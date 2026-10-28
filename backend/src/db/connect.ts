import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import {
  createPgDatabase,
  setDatabase,
  closeDatabase,
  getDatabase,
} from "./database.js";
import { initializeSchema } from "./schema.js";

/**
 * Create the connection pool, verify it can reach Postgres, and apply the
 * idempotent `amr` schema. The schema is owned by this application and is safe
 * to initialize on every process start.
 */
export async function connectDatabase(config: AppConfig, logger: Logger): Promise<void> {
  const database = createPgDatabase({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
    // Serverless instances are reused, so keep the per-instance pool small
    // and leave headroom in the Supabase pooler for other instances.
    maxConnections: 3,
  });

  try {
    await database.ping();
    await initializeSchema(database);
  } catch (error) {
    await database.close().catch(() => undefined);
    throw error;
  }

  setDatabase(database);
  logger.info(database.info, "connected to Postgres");
}

export async function disconnectDatabase(): Promise<void> {
  await closeDatabase();
}

export function isDatabaseConnected(): boolean {
  try {
    getDatabase();
    return true;
  } catch {
    return false;
  }
}
