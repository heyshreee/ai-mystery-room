import { cn } from "../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "border-brass/80 bg-brass text-ink hover:bg-brass-bright focus-visible:outline-brass-bright disabled:border-brass/30 disabled:bg-brass/30 disabled:text-ink/60",
  secondary:
    "border-brass/35 bg-transparent text-paper hover:border-brass/70 hover:bg-brass/10 focus-visible:outline-brass-bright disabled:border-white/10 disabled:text-paper/35",
  ghost:
    "border-transparent bg-transparent text-paper/75 hover:bg-white/5 hover:text-paper focus-visible:outline-brass disabled:text-paper/30",
  danger:
    "border-signal/60 bg-signal/15 text-signal-bright hover:bg-signal/25 focus-visible:outline-signal-bright disabled:border-white/10 disabled:text-paper/35",
};

export function buttonClasses(
  variant: Variant = "primary",
  className?: string,
): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    variantClasses[variant],
    className,
  );
}
