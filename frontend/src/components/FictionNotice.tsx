import type { ReactNode } from "react";

export function FictionNotice({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={[
        "flex gap-3 border border-white/10 bg-white/[0.025] px-4 py-3.5 text-xs leading-relaxed text-paper/55",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-4 shrink-0 place-items-center border border-brass/60 font-mono text-[0.5rem] text-brass-bright"
      >
        F
      </span>
      <p>
        {children ??
          "Everything in this room is fiction. People, messages, images, and records are simulated for the puzzle. Do not treat them as real evidence."}
      </p>
    </aside>
  );
}
