import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  EVIDENCE_TYPE_LABELS,
  RELIABILITY_LABELS,
  type PublicCase,
  type ResultView,
} from "@amr/shared";
import { api } from "../lib/api";
import { formatDateTime, initials } from "../lib/format";
import { useStartSampleCase } from "../hooks/useStartSampleCase";
import { Badge, Divider, Kicker, Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/button-classes";
import { ErrorPanel } from "../components/ErrorPanel";
import { LoadingState } from "../components/Spinner";
import { FictionNotice } from "../components/FictionNotice";
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  FileIcon,
  ScaleIcon,
  SparkIcon,
} from "../components/Icons";
import { NotFoundPage } from "./NotFoundPage";

interface ResultsData {
  result: ResultView;
  caseData: PublicCase;
}

export function ResultsPage() {
  const { caseId, sessionId } = useParams();
  if (!caseId || !sessionId) {
    return <NotFoundPage />;
  }
  return <ResultsView caseId={caseId} sessionId={sessionId} />;
}

function ResultsView({ caseId, sessionId }: { caseId: string; sessionId: string }) {
  const sample = useStartSampleCase();
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    api
      .getResults(sessionId, controller.signal)
      .then(async (result) => {
        const caseData = await api.getCase(result.caseId, controller.signal);
        if (active) {
          setData({ result, caseData });
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }
        setError(caught);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionId, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  if (loading) {
    return (
      <PageFrame>
        <LoadingState label="Opening the final case report…" />
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame>
        <ErrorPanel
          title="The case result could not be opened"
          error={error}
          onRetry={reload}
          retryLabel="Reload the result"
        >
          <Link
            to={`/case/${caseId}`}
            className={buttonClasses("secondary", "mt-1")}
          >
            <ArrowLeftIcon className="size-4" />
            Return to the case file
          </Link>
        </ErrorPanel>
      </PageFrame>
    );
  }

  if (!data) {
    return (
      <PageFrame>
        <LoadingState label="Preparing the final report…" />
      </PageFrame>
    );
  }

  const { result, caseData } = data;
  const correct = result.correct;
  const completedAt = formatDateTime(result.completedAt, caseData.timezone);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-paper/45 hover:text-paper/75"
      >
        <ArrowLeftIcon className="size-3.5" />
        Leave the case room
      </Link>

      <section
        className={[
          "mt-5 overflow-hidden border",
          correct
            ? "border-moss/40 bg-moss/[0.05]"
            : "border-signal/40 bg-signal/[0.055]",
        ].join(" ")}
        aria-labelledby="verdict-title"
      >
        <div className="px-5 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={correct ? "paper" : "signal"}>
              {correct ? "Correct identification" : "Accusation incorrect"}
            </Badge>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper/40">
              Case closed · {completedAt}
            </span>
          </div>
          <div className="mt-4 flex items-start gap-4">
            <span
              className={[
                "grid size-12 shrink-0 place-items-center border",
                correct
                  ? "border-moss/50 bg-moss/10 text-moss"
                  : "border-signal/50 bg-signal/10 text-signal-bright",
              ].join(" ")}
              aria-hidden="true"
            >
              {correct ? <CheckIcon className="size-6" /> : <AlertIcon className="size-6" />}
            </span>
            <div className="min-w-0">
              <h1
                id="verdict-title"
                className="font-display text-3xl leading-tight text-paper sm:text-4xl"
              >
                {correct ? "The evidence holds." : "The file points elsewhere."}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/65">
                {correct
                  ? `You accused ${result.selectedSuspect.displayName}, and the canonical solution agrees. The full reasoning is below.`
                  : `You accused ${result.selectedSuspect.displayName}. The canonical culprit was ${result.culprit.displayName}. The complete reasoning is below.`}
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-0 border-t border-white/10 sm:grid-cols-3">
          <div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r sm:px-8">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
              Case
            </p>
            <p className="mt-1.5 text-sm text-paper/80">{caseData.title}</p>
          </div>
          <div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r sm:px-8">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
              Your accusation
            </p>
            <p className="mt-1.5 text-sm text-paper/80">{result.selectedSuspect.displayName}</p>
          </div>
          <div className="px-5 py-4 sm:px-8">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
              Canonical culprit
            </p>
            <p className="mt-1.5 text-sm text-paper/80">{result.culprit.displayName}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel className="p-5 sm:p-6">
            <Kicker>What happened</Kicker>
            <h2 className="mt-1 font-display text-2xl text-paper">The solution</h2>
            <div className="mt-5 space-y-5">
              <section>
                <h3 className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
                  Motive
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-paper/70">{result.solution.motive}</p>
              </section>
              <Divider />
              <section>
                <h3 className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
                  Method
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-paper/70">{result.solution.method}</p>
              </section>
              <Divider />
              <section>
                <h3 className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
                  How the evidence resolves
                </h3>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-paper/70">
                  {result.solution.explanation}
                </p>
              </section>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <Kicker>Clues the answer rests on</Kicker>
              <h2 className="mt-1 font-display text-2xl text-paper">Supporting evidence</h2>
              <p className="mt-1 text-xs text-paper/45">
                {result.supportingEvidence.length} exhibits support the canonical solution.
              </p>
            </div>
            <ol className="divide-y divide-white/[0.06]">
              {result.supportingEvidence.map((evidence) => (
                <li key={evidence.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-brass/75">
                      EXH-{String(evidence.exhibitNumber).padStart(2, "0")} ·{" "}
                      {EVIDENCE_TYPE_LABELS[evidence.type]}
                    </span>
                    <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                      {RELIABILITY_LABELS[evidence.reliability]}
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-lg text-paper">{evidence.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-paper/55">
                    {evidence.publicDescription}
                  </p>
                  <p className="mt-2 text-[0.66rem] text-paper/35">{evidence.sourceLabel}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel className="p-5">
            <Kicker>Score</Kicker>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="font-display text-5xl leading-none text-brass-bright">
                {result.score.total}
              </p>
              <p className="pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-paper/35">
                points
              </p>
            </div>
            <dl className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-paper/45">Correct accusation</dt>
                <dd className="font-mono text-paper/75">+{result.score.base}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-paper/45">
                  Hint penalty ({result.score.hintsUsed} used)
                </dt>
                <dd className="font-mono text-paper/75">
                  {result.score.hintPenalty > 0 ? `−${result.score.hintPenalty}` : "0"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                <dt className="font-medium text-paper/65">Total</dt>
                <dd className="font-mono font-medium text-brass-bright">{result.score.total}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[0.66rem] leading-relaxed text-paper/35">
              Scored on the server. The client cannot submit a score or change a completed
              accusation.
            </p>
          </Panel>

          <Panel className="p-5">
            <Kicker>Canonical culprit</Kicker>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full border border-brass/40 bg-brass/5 font-mono text-sm text-brass-bright">
                {initials(result.culprit.displayName)}
              </span>
              <div>
                <h2 className="font-display text-xl leading-tight text-paper">
                  {result.culprit.displayName}
                </h2>
                <p className="text-[0.68rem] text-brass/75">{result.culprit.role}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-paper/55">{result.culprit.profile}</p>
            <details className="mt-3 border-t border-white/10 pt-3">
              <summary className="cursor-pointer text-[0.68rem] text-brass/80 hover:text-brass-bright">
                Motive and opportunity
              </summary>
              <div className="mt-2 space-y-2 text-[0.68rem] leading-relaxed text-paper/50">
                <p>
                  <span className="font-medium text-paper/70">Motive: </span>
                  {result.culprit.motiveSummary}
                </p>
                <p>
                  <span className="font-medium text-paper/70">Opportunity: </span>
                  {result.culprit.opportunitySummary}
                </p>
              </div>
            </details>
          </Panel>

          <Panel className="p-5">
            <Kicker>Next file</Kicker>
            <h2 className="mt-1 font-display text-xl text-paper">Keep investigating</h2>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                onClick={sample.start}
                loading={sample.pending}
                loadingLabel="Preparing the file…"
                icon={<FileIcon className="size-4" />}
              >
                Play the sample again
              </Button>
              <Link to="/create" className={buttonClasses("secondary")}>
                <SparkIcon className="size-4" />
                Create a mystery
              </Link>
              <Link to="/" className={buttonClasses("ghost")}>
                Return home
              </Link>
            </div>
            {sample.error ? (
              <p role="alert" className="mt-3 text-xs leading-relaxed text-signal-bright">
                {sample.error instanceof Error
                  ? sample.error.message
                  : "The sample could not be prepared."}
              </p>
            ) : null}
          </Panel>

          <div className="flex items-start gap-2 px-1 text-[0.66rem] leading-relaxed text-paper/35">
            <ScaleIcon className="mt-0.5 size-3.5 shrink-0" />
            <p>
              The reveal is available because this session completed its final accusation.
            </p>
          </div>
        </aside>
      </div>

      <FictionNotice className="mt-8">
        {caseData.fictionNotice || result.fictionNotice}
      </FictionNotice>

      <div className="mt-4">
        <Link to="/" className={buttonClasses("ghost")}>
          <ArrowLeftIcon className="size-4" />
          Leave the case room
        </Link>
      </div>
    </div>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">{children}</div>
  );
}
