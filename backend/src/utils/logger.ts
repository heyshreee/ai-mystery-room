import pino, { type Logger } from "pino";

export type { Logger };

export function createLogger(level = "info"): Logger {
  return pino({
    level,
    base: { service: "ai-mystery-room-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      censor: "[redacted]",
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "headers.cookie",
        "headers.authorization",
        "*.password",
        "*.token",
        "*.guestToken",
        "*.sessionToken",
        "*.apiKey",
        "*.SESSION_SECRET",
        "*.AI_API_KEY",
      ],
    },
  });
}
