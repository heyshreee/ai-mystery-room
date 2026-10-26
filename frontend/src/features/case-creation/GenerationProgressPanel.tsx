import {
  type GenerationStatusView,
} from "@amr/shared";
import { ApiError } from "../../lib/api";
import {
  GENERATION_PROGRESS_STEPS,
  generationProviderLabel,
  generationStageLabel,
  generationStepState,
} from "../../lib/generation";
import { Button } from "../../components/Button";
import { Panel, Kicker, Badge } from "../../components/Panel";
import { Spinner } from "../../components/Spinner";
import { ErrorPanel } from "../../components/ErrorPanel";
import {
  AlertIcon,
  CheckIcon,
  FileIcon,
  RefreshIcon,
  SparkIcon,
} from "../../components/Icons";

const ERROR_LABELS: Record<string, string> = {
  AI_PROVIDER_UNAVAILABLE: "Generator unavailable",
  GENERATION_TIMEOUT: "Generator timed out",
  INVALID_AI_OUTPUT: "Output rejected by validation",
  GENERATION_FAILED: "Generation failed",
};

export function GenerationProgressPanel({
  generation,
  pollError,
  onRetryPoll,
  onRetryGeneration,
  onChangeBrief,
  onPlaySample,
  samplePending,
  sampleError,
  retryPending,
}: {
  generation: GenerationStatusView;
  pollError: unknown;
  onRetryPoll: () => void;
  onRetryGeneration: () => void;
  onChangeBrief: () => void;
  onPlaySample: () => void;
  samplePending: boolean;
  sampleError: unknown;
  retryPending: boolean;
}) {
  if (generation.status === "failed") {
    return (
      <Panel className="mt-5 border-signal/40 p-5 sm:p-6" as="section">
        <div className="flex items-start gap-3">
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-signal-bright" />
          <div className="min-w-0 flex-1" role="alert">
            <Kicker className="text-signal-bright">Generation stopped</Kicker>
            <h2 className="mt-1 font-display text-2xl text-paper">
              The case was not published
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">
              {generation.message ??
                "The generator did not produce a case that passed validation. No partial case is playable."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="signal">
                {ERROR_LABELS[generation.errorCode ?? ""] ?? "Generation failed"}
              </Badge>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper/35">
                {generationProviderLabel(generation.provider)}
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-paper/45">
              Your brief is still in the form. A retry uses a new request key; no
              half-written suspects, evidence, or solution were kept.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                onClick={onRetryGeneration}
                loading={retryPending}
                loadingLabel="Submitting the brief…"
                icon={<RefreshIcon className="size-4" />}
              >
                Try this brief again
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onChangeBrief}
                disabled={retryPending}
              >
                Change the brief
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onPlaySample}
                loading={samplePending}
                loadingLabel="Preparing the sample…"
                icon={<FileIcon className="size-4" />}
              >
                Play the sample instead
              </Button>
            </div>
            {sampleError ? (
              <ErrorPanel
                className="mt-4"
                title="The sample could not be prepared"
                error={sampleError}
                onRetry={onPlaySample}
              />
            ) : null}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel className="mt-5 border-brass/35 p-5 sm:p-6" as="section">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center border border-brass/35 bg-brass/5 text-brass-bright">
            <SparkIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <Kicker>Generation progress</Kicker>
            <h2 className="mt-1 font-display text-2xl text-paper">
              {generation.status === "ready"
                ? "Case file ready"
                : "Building the case file"}
            </h2>
            <div
              className="mt-2 flex items-center gap-2 text-sm text-paper/70"
              role="status"
              aria-live="polite"
            >
              <Spinner className="size-4 text-brass" />
              <span>
                {generation.message ?? generationStageLabel(generation.stage)}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-paper/35">
              {generationProviderLabel(generation.provider)}
            </p>

            <ol className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Generation stages">
              {GENERATION_PROGRESS_STEPS.map((step) => {
                const state = generationStepState(generation.stage, step.stage);
                return (
                  <li
                    key={step.stage}
                    aria-current={state === "active" ? "step" : undefined}
                    className={[
                      "flex gap-3 border px-3 py-2.5",
                      state === "active"
                        ? "border-brass/40 bg-brass/[0.06]"
                        : "border-white/10 bg-white/[0.015]",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                        state === "complete"
                          ? "border-moss/50 text-moss"
                          : state === "active"
                            ? "border-brass/60 text-brass-bright"
                            : "border-white/15 text-paper/25",
                      ].join(" ")}
                    >
                      {state === "complete" ? (
                        <CheckIcon className="size-3" />
                      ) : state === "active" ? (
                        <span className="size-1.5 rounded-full bg-current" />
                      ) : (
                        <span className="size-1 rounded-full bg-current" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={[
                          "block text-xs font-medium",
                          state === "waiting" ? "text-paper/40" : "text-paper",
                        ].join(" ")}
                      >
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-paper/40">
                        {step.summary}
                      </span>
                      <span className="sr-only">
                        {state === "complete"
                          ? "Complete"
                          : state === "active"
                            ? "In progress"
                            : "Waiting"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="mt-4 text-xs leading-relaxed text-paper/40">
              No percentage is shown because the server reports stages, not measured
              completion. Duplicate submissions are blocked while this file is being
              prepared.
            </p>
          </div>
        </div>
      </Panel>

      {pollError ? (
        <Panel className="mt-4 border-signal/35 bg-signal/[0.05] p-5" as="section">
          <div className="flex items-start gap-3" role="alert">
            <AlertIcon className="mt-0.5 size-5 shrink-0 text-signal-bright" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl text-paper">
                Progress check interrupted
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/70">
                {pollError instanceof ApiError
                  ? pollError.message
                  : "The API could not be reached while checking this generation."}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-paper/45">
                The case may still be generating on the server. Check again before
                submitting the brief a second time.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onRetryPoll}
                  icon={<RefreshIcon className="size-4" />}
                >
                  Check again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onPlaySample}
                  loading={samplePending}
                  loadingLabel="Preparing the sample…"
                  icon={<FileIcon className="size-4" />}
                >
                  Play the sample while you wait
                </Button>
              </div>
              {sampleError ? (
                <ErrorPanel
                  className="mt-4"
                  title="The sample could not be prepared"
                  error={sampleError}
                  onRetry={onPlaySample}
                />
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}
    </>
  );
}
