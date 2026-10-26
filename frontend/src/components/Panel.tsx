import type { ReactNode } from "react";
import { cn } from "../lib/format";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brass" | "signal" | "paper";
  className?: string;
}) {
  const tones = {
    neutral: "border-white/15 text-paper/65",
    brass: "border-brass/50 text-brass-bright",
    signal: "border-signal/50 text-signal-bright",
    paper: "border-paper/25 text-paper",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.66rem] font-medium uppercase tracking-[0.16em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-white/10", className)} aria-hidden="true" />;
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[0.68rem] font-medium uppercase tracking-[0.24em] text-brass/85",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "aside" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-sm border border-white/10 bg-panel/80 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
