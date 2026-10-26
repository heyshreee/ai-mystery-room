import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const root = resolve(import.meta.dirname, "..");
const backendEntry = resolve(root, "backend/dist/server.js");
const frontendDist = resolve(root, "frontend/dist/index.html");
const viteEntry = resolve(root, "node_modules/vite/bin/vite.js");

for (const [label, path] of [
  ["backend build", backendEntry],
  ["frontend build", frontendDist],
  ["Vite", viteEntry],
]) {
  if (!existsSync(path)) {
    console.error(
      `[e2e] Missing ${label} at ${path}. Run "npm run build" before the E2E suite.`,
    );
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

function start(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[e2e] ${label} exited unexpectedly (code ${code}, signal ${signal}).`);
      void shutdown(1);
    }
  });
  children.push(child);
  return child;
}

async function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  await mongo.stop().catch(() => undefined);
  process.exit(code);
}

process.on("SIGTERM", () => {
  void shutdown(0);
});
process.on("SIGINT", () => {
  void shutdown(0);
});

process.env.MONGOMS_DOWNLOAD_DIR ??= resolve(
  root,
  "backend/.cache/mongodb-binaries",
);
process.env.MONGOMS_VERSION ??= "8.0.4";
const mongo = await MongoMemoryServer.create({
  binary: { version: "8.0.4" },
  instance: { dbName: "amr_e2e" },
});

start("backend", process.execPath, [backendEntry], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "test",
    PORT: "4000",
    MONGODB_URI: mongo.getUri("amr_e2e"),
    SESSION_SECRET: "e2e_session_secret_that_is_longer_than_thirty_two_characters",
    FRONTEND_ORIGIN: "http://127.0.0.1:4173,http://localhost:4173",
    LOG_LEVEL: "warn",
    AI_PROVIDER: "mock",
    MEDIA_PROVIDER: "static",
    CASE_GENERATION_LIMIT_PER_HOUR: "100",
    API_RATE_LIMIT_MAX: "10000",
  },
});

await waitForUrl("http://127.0.0.1:4000/api/health");

start(
  "frontend preview",
  process.execPath,
  [viteEntry, "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  {
    cwd: resolve(root, "frontend"),
    env: process.env,
  },
);

console.log("[e2e] stack ready: api http://127.0.0.1:4000, web http://127.0.0.1:4173");

async function waitForUrl(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`[e2e] Timed out waiting for ${url}`);
}
