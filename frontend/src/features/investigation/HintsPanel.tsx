import { ApiError } from "../../lib/api";
import { cn } from "../../lib/format";
import { Button } from "../../components/Button";
import { Kicker, Panel } from "../../components/Panel";
import { AlertIcon, SparkIcon } from "../../components/Icons";

interface ReceivedHint {
  hintsUsed: number;
  hint: string;
}

export function HintsPanel({
  hintsUsed,
  hintLimit,
  hints,
  pending,
  error,
  onRequest,
}: {
  hintsUsed: number;
  hintLimit: number;
  hints: ReceivedHint[];
  pending: boolean;
  error: unknown;
  onRequest: () => void;
}) {
  const remaining = Math.max(0, hintLimit - hintsUsed);
  const limitReached = remaining === 0;
  const missingEarlierHints = hintsUsed > hints.length;
  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The hint could not be retrieved.";

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <Kicker>Detective's nudge</Kicker>
          <h2 className="mt-1 font-display text-xl text-paper">Hints</h2>
        </div>
        <span
          className={cn(
            "grid size-9 place-items-center border",
            limitReached
              ? "border-white/10 text-paper/30"
              : "border-brass/40 bg-brass/5 text-brass-bright",
          )}
          aria-hidden="true"
        >
          <SparkIcon className="size-4" />
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <p className="text-paper/55">
            {hintsUsed} of {hintLimit} used
          </p>
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-paper/40">
            −10 points each
          </p>
        </div>
        <div
          className="mt-2 flex gap-1.5"
          role="img"
          aria-label={`${hintsUsed} of ${hintLimit} hints used`}
        >
          {Array.from({ length: hintLimit }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1",
                index < hintsUsed ? "bg-brass/80" : "bg-white/10",
              )}
            />
          ))}
        </div>

        {hints.length > 0 ? (
          <ol className="mt-4 space-y-3">
            {hints.map((received) => (
              <li
                key={received.hintsUsed}
                className="border-l-2 border-brass/35 bg-white/[0.02] py-2 pl-3"
              >
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-brass/70">
                  Hint {received.hintsUsed}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-paper/70">{received.hint}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-paper/45">
            Hints point to inconsistencies in the record. They never name the culprit.
          </p>
        )}

        {missingEarlierHints ? (
          <p className="mt-3 border border-white/10 px-3 py-2 text-[0.68rem] leading-relaxed text-paper/45">
            You used {hintsUsed - hints.length} hint
            {hintsUsed - hints.length === 1 ? "" : "s"} earlier in this session. Previous
            hint text is not replayed after a refresh.
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-3 flex gap-2 border border-signal/30 bg-signal/[0.06] px-3 py-2"
          >
            <AlertIcon className="mt-0.5 size-3.5 shrink-0 text-signal-bright" />
            <p className="text-[0.7rem] leading-relaxed text-paper/70">{errorMessage}</p>
          </div>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          onClick={onRequest}
          loading={pending}
          loadingLabel="Reading the file…"
          disabled={limitReached}
          icon={<SparkIcon className="size-4" />}
        >
          {limitReached ? "All hints used" : `Request hint (${remaining} left)`}
        </Button>
        {error && !limitReached ? (
          <button
            type="button"
            onClick={onRequest}
            disabled={pending}
            className="mt-2 w-full text-center text-[0.7rem] text-brass underline decoration-brass/40 underline-offset-4 hover:text-brass-bright disabled:text-paper/30"
          >
            Retry hint request
          </button>
        ) : null}
        <p className="mt-2 text-center text-[0.62rem] leading-relaxed text-paper/35">
          Hint requests are rate-limited by the server.
        </p>
      </div>
    </Panel>
  );
}
