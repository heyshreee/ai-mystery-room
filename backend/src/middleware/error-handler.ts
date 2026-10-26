import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { formatZodIssues } from "../utils/validation.js";
import type { Logger } from "../utils/logger.js";

export function notFoundHandler() {
  return (_req: Request, res: Response): void => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exist.",
        requestId: typeof res.locals.requestId === "string" ? res.locals.requestId : "unknown",
      },
    });
  };
}

export function errorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId =
      typeof res.locals.requestId === "string" ? res.locals.requestId : "unknown";

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please correct the highlighted fields.",
          details: formatZodIssues(error),
          requestId,
        },
      });
      return;
    }

    if (isBodyParserError(error)) {
      const tooLarge = error.type === "entity.too.large";
      res.status(tooLarge ? 413 : 400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: tooLarge
            ? "The request body is too large."
            : "The request body is not valid JSON.",
          requestId,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(
          {
            requestId,
            method: req.method,
            path: req.path,
            code: error.code,
            err: error,
          },
          "request failed",
        );
      }
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.expose ? error.message : "The request could not be completed.",
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      });
      return;
    }

    logger.error(
      {
        requestId,
        method: req.method,
        path: req.path,
        err: error,
      },
      "unhandled request error",
    );

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again.",
        requestId,
      },
    });
  };
}

function isBodyParserError(error: unknown): error is { type: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const type = (error as { type?: unknown }).type;
  return type === "entity.parse.failed" || type === "entity.too.large";
}
