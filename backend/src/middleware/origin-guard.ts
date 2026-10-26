import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";

export function originGuardMiddleware(allowedOrigins: string[]) {
  const allowlist = new Set(allowedOrigins);
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }

    const origin = req.get("origin");
    if (origin && !allowlist.has(origin)) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "This origin is not permitted to change game state.",
        ),
      );
      return;
    }

    next();
  };
}
