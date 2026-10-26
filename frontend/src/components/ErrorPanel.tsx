import type { ReactNode } from "react";
import { ApiError } from "../lib/api";
import { cn } from "../lib/format";
import { AlertIcon, RefreshIcon } from "./Icons";
import { buttonClasses } from "./button-classes";

export function ErrorPanel({
  title = "The case file could not be opened",
  error,
  onRetry,
  retryLabel = "Try again",
  children,
  className,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
  const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <div
      className={cn(
        "border border-signal/35 bg-signal/[0.06] p-5 sm:p-6",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 size-5 shrink-0 text-signal-bright" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-paper">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper/70">{message}</p>
          {code ? (
            <p className="mt-3 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-paper/35">
              Error {code}
              {requestId ? ` · Request ${requestId.slice(0, 8)}` : ""}
            </p>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={buttonClasses("secondary", "mt-5")}
            >
              <RefreshIcon className="size-4" />
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
