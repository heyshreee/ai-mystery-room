import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../utils/errors.js";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request, res: Response) => string;
  message?: string;
  now?: () => number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * A small in-memory fixed-window limiter. This is intentionally dependency-free
 * and testable. A shared store is required before horizontal scaling.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  const now = options.now ?? Date.now;

  return (req: Request, res: Response, next: NextFunction): void => {
    const currentTime = now();
    const rawKey =
      options.keyGenerator?.(req, res) ??
      req.ip ??
      req.socket.remoteAddress ??
      "unknown";
    const key = `${options.keyPrefix}:${rawKey}`;

    let entry = entries.get(key);
    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + options.windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, options.max - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(resetSeconds));
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          options.message ?? "Too many requests. Please wait and try again.",
        ),
      );
      return;
    }

    if (entries.size > 10_000) {
      for (const [storedKey, storedEntry] of entries) {
        if (storedEntry.resetAt <= currentTime) {
          entries.delete(storedKey);
        }
      }
    }

    next();
  };
}
