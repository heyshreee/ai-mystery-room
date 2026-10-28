import pg from "pg";

export type DatabaseSslMode = "disable" | "require" | "no-verify";

export interface DatabaseInfo {
  host: string;
  database: string;
}

/**
 * Minimal query surface used by the repositories. Keeping this interface small
 * lets tests and E2E use a real Postgres implementation (PGlite over TCP)
 * without changing application code.
 */
export interface Database {
  readonly info: DatabaseInfo;
  readonly rawPool?: pg.Pool;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  execute(sql: string, params?: readonly unknown[]): Promise<number>;
  transaction<T>(callback: (database: Database) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

class PgDatabase implements Database {
  constructor(
    private readonly client: pg.Pool | pg.PoolClient,
    readonly info: DatabaseInfo,
    readonly rawPool?: pg.Pool,
  ) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.client.query(sql, params as unknown[]);
    return result.rows as T[];
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<number> {
    const result = await this.client.query(sql, params as unknown[]);
    return result.rowCount ?? 0;
  }

  async transaction<T>(callback: (database: Database) => Promise<T>): Promise<T> {
    if (!this.rawPool) {
      throw new Error("Nested database transactions are not supported.");
    }

    const client = await this.rawPool.connect();
    const transaction = new PgDatabase(client, this.info);
    try {
      await client.query("BEGIN");
      const result = await callback(transaction);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.query("SELECT 1");
  }

  async close(): Promise<void> {
    if (this.rawPool) {
      await this.rawPool.end();
    }
  }
}

let activeDatabase: Database | undefined;

export function setDatabase(database: Database): void {
  activeDatabase = database;
}

export function getDatabase(): Database {
  if (!activeDatabase) {
    throw new Error("The database has not been connected.");
  }
  return activeDatabase;
}

export function clearDatabase(): void {
  activeDatabase = undefined;
}

export async function closeDatabase(): Promise<void> {
  const database = activeDatabase;
  activeDatabase = undefined;
  if (database) {
    await database.close();
  }
}

export async function pingDatabase(): Promise<void> {
  await getDatabase().ping();
}

function sslConfig(mode: DatabaseSslMode): false | { rejectUnauthorized: boolean } {
  if (mode === "disable") {
    return false;
  }
  return { rejectUnauthorized: mode === "require" };
}

/**
 * `pg` also understands `sslmode` in the URL, but it can conflict with the
 * explicit TLS mode. Strip it before constructing the pool and rely on
 * DATABASE_SSL, which is validated alongside the rest of the environment.
 */
function sanitizedConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return url.toString();
}

export interface PgDatabaseOptions {
  connectionString: string;
  ssl: DatabaseSslMode;
  maxConnections?: number;
}

export function createPgDatabase({
  connectionString,
  ssl,
  maxConnections = 5,
}: PgDatabaseOptions): Database {
  const url = new URL(connectionString);
  const pool = new pg.Pool({
    connectionString: sanitizedConnectionString(connectionString),
    ssl: sslConfig(ssl),
    max: maxConnections,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    application_name: "ai-mystery-room",
  });

  return new PgDatabase(
    pool,
    {
      host: url.hostname,
      database: url.pathname.replace(/^\//, "") || "postgres",
    },
    pool,
  );
}
