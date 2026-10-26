import type { ZodType } from "zod";
import type { ApiErrorDetail } from "@amr/shared";
import { AppError } from "./errors.js";

export function formatZodIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "body",
    message: issue.message,
  }));
}

export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      { details: formatZodIssues(parsed.error) },
    );
  }
  return parsed.data;
}

export function requestIdFrom(res: {
  locals: Record<string, unknown>;
}): string {
  return typeof res.locals.requestId === "string" ? res.locals.requestId : "unknown";
}
