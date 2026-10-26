import { cn } from "../lib/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function LoadingState({
  label = "Opening the case file…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 text-sm text-paper/65", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-4 text-brass" />
      <span>{label}</span>
    </div>
  );
}
