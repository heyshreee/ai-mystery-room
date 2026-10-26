import { loadConfig } from "./config/env.js";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./db/connect.js";
import { recoverInterruptedGenerations } from "./services/generation-recovery.js";
import { createLogger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  await connectDatabase(config, logger);
  await recoverInterruptedGenerations(logger);

  const app = createApp({ config, logger });
  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        environment: config.nodeEnv,
        aiProvider: config.aiProvider,
      },
      "AI Mystery Room API listening",
    );
  });

  server.requestTimeout = 90_000;
  server.headersTimeout = 20_000;

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    const forcedExit = setTimeout(() => {
      logger.error("graceful shutdown timed out");
      process.exit(1);
    }, 10_000);
    forcedExit.unref();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await disconnectDatabase();
    clearTimeout(forcedExit);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("AI Mystery Room API failed to start:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
