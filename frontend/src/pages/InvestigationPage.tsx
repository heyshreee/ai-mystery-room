import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CATEGORY_LABELS,
  CORRECT_BASE_SCORE,
  DIFFICULTY_LABELS,
  HINT_PENALTY,
  type EvidenceDetail,
  type PublicCase,
} from "@amr/shared";
import { api, ApiError } from "../lib/api";
import { formatDateTime, formatSessionExpiry, percent } from "../lib/format";
import { usePublicCase } from "../hooks/usePublicCase";
import { useCaseSession } from "../hooks/useCaseSession";
import { Badge, Kicker, Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { ErrorPanel } from "../components/ErrorPanel";
import { LoadingState } from "../components/Spinner";
import { FictionNotice } from "../components/FictionNotice";
import {
  AlertIcon,
  ArrowLeftIcon,
  ClockIcon,
  EyeIcon,
  FileIcon,
  ScaleIcon,
} from "../components/Icons";
import { SuspectsPanel } from "../features/investigation/SuspectsPanel";
import { EvidenceBrowser } from "../features/investigation/EvidenceBrowser";
import { TimelinePanel } from "../features/investigation/TimelinePanel";
import { HintsPanel } from "../features/investigation/HintsPanel";
import { AccusationDialog } from "../features/investigation/AccusationDialog";
import { NotFoundPage } from "./NotFoundPage";

export function InvestigationPage() {
  const { caseId } = useParams();
  if (!caseId) {
    return <NotFoundPage />;
  }
  return <InvestigationRoom caseId={caseId} />;
}

function InvestigationRoom({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const publicCase = usePublicCase(caseId);
  const caseSession = useCaseSession(caseId);
  const {
    caseData,
    evidence,
    loading: caseLoading,
    error: caseError,
    reload: reloadCase,
  } = publicCase;
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    reload: reloadSession,
    setSession,
    updateSession,
  } = caseSession;

  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [progressError, setProgressError] = useState<unknown>(null);
  const [sessionProblem, setSessionProblem] = useState<unknown>(null);
  const [hints, setHints] = useState<Array<{ hintsUsed: number; hint: string }>>([]);
  const [hintPending, setHintPending] = useState(false);
  const [hintError, setHintError] = useState<unknown>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [accusedSuspectId, setAccusedSuspectId] = useState<string | null>(null);
  const [accusationPending, setAccusationPending] = useState(false);
  const [accusationError, setAccusationError] = useState<unknown>(null);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    if (!caseData) {
      return;
    }
    setSelectedSuspectId((current) =>
      current && caseData.suspects.some((suspect) => suspect.id === current)
        ? current
        : (caseData.suspects[0]?.id ?? null),
    );
  }, [caseData]);

  useEffect(() => {
    if (session?.status === "completed") {
      navigate(`/case/${caseId}/results/${session.id}`, { replace: true });
    }
  }, [session, caseId, navigate]);

  useEffect(() => {
    setHints([]);
    setHintError(null);
  }, [session?.id]);

  const noteSessionProblem = useCallback((error: unknown) => {
    if (
      error instanceof ApiError &&
      (error.code === "SESSION_NOT_FOUND" ||
        error.code === "SESSION_EXPIRED" ||
        error.code === "SESSION_COMPLETED")
    ) {
      setSessionProblem(error);
    }
  }, []);

  const openEvidence = useCallback(
    async (evidenceId: string) => {
      const requestNumber = detailRequestRef.current + 1;
      detailRequestRef.current = requestNumber;
      setSelectedEvidenceId(evidenceId);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      setProgressError(null);

      try {
        const evidenceDetail = await api.getEvidence(evidenceId);
        if (requestNumber !== detailRequestRef.current) {
          return;
        }
        setDetail(evidenceDetail);
        setDetailLoading(false);

        if (session && !session.viewedEvidenceIds.includes(evidenceId)) {
          try {
            const updated = await api.recordProgress(session.id, evidenceId);
            if (requestNumber === detailRequestRef.current) {
              setSession(updated);
            }
          } catch (error) {
            if (requestNumber === detailRequestRef.current) {
              setProgressError(error);
              noteSessionProblem(error);
            }
          }
        }
      } catch (error) {
        if (requestNumber !== detailRequestRef.current) {
          return;
        }
        setDetailError(error);
        setDetailLoading(false);
        noteSessionProblem(error);
      }
    },
    [session, setSession, noteSessionProblem],
  );

  const retryDetail = useCallback(() => {
    if (selectedEvidenceId) {
      void openEvidence(selectedEvidenceId);
    }
  }, [openEvidence, selectedEvidenceId]);

  const requestHint = useCallback(async () => {
    if (!session || hintPending) {
      return;
    }
    setHintPending(true);
    setHintError(null);
    try {
      const result = await api.requestHint(session.id);
      setHints((current) => {
        const next = current.filter((entry) => entry.hintsUsed !== result.hintsUsed);
        next.push({ hintsUsed: result.hintsUsed, hint: result.hint });
        return next.sort((left, right) => left.hintsUsed - right.hintsUsed);
      });
      updateSession((current) => ({
        ...current,
        hintsUsed: result.hintsUsed,
        hintsRemaining: result.hintsRemaining,
      }));
    } catch (error) {
      setHintError(error);
      noteSessionProblem(error);
    } finally {
      setHintPending(false);
    }
  }, [session, hintPending, updateSession, noteSessionProblem]);

  const openAccusation = useCallback(
    (suspectId?: string) => {
      setAccusedSuspectId(suspectId ?? selectedSuspectId ?? null);
      setAccusationError(null);
      setAccuseOpen(true);
    },
    [selectedSuspectId],
  );

  const closeAccusation = useCallback(() => {
    if (accusationPending) {
      return;
    }
    setAccuseOpen(false);
    setAccusationError(null);
  }, [accusationPending]);

  const confirmAccusation = useCallback(async () => {
    if (!session || !accusedSuspectId || accusationPending) {
      return;
    }
    setAccusationPending(true);
    setAccusationError(null);
    try {
      const result = await api.submitAccusation(session.id, accusedSuspectId);
      navigate(`/case/${caseId}/results/${result.sessionId}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SESSION_COMPLETED") {
        setAccuseOpen(false);
        navigate(`/case/${caseId}/results/${session.id}`);
        return;
      }
      setAccusationError(error);
      noteSessionProblem(error);
    } finally {
      setAccusationPending(false);
    }
  }, [
    session,
    accusedSuspectId,
    accusationPending,
    caseId,
    navigate,
    noteSessionProblem,
  ]);

  const restartSession = useCallback(() => {
    setSessionProblem(null);
    setProgressError(null);
    setSelectedEvidenceId(null);
    setDetail(null);
    setDetailError(null);
    reloadSession();
  }, [reloadSession]);

  if (caseError) {
    return (
      <PageFrame>
        <ErrorPanel
          title="The case file could not be opened"
          error={caseError}
          onRetry={reloadCase}
          retryLabel="Reload the case"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-brass underline decoration-brass/40 underline-offset-4"
          >
            <ArrowLeftIcon className="size-3.5" />
            Return to the room
          </Link>
        </ErrorPanel>
      </PageFrame>
    );
  }

  if (sessionError) {
    return (
      <PageFrame>
        <ErrorPanel
          title="The investigation session could not be opened"
          error={sessionError}
          onRetry={reloadSession}
          retryLabel="Start the session again"
        >
          <p className="text-xs leading-relaxed text-paper/45">
            A new session starts from the beginning of the file. The case itself is
            unchanged.
          </p>
        </ErrorPanel>
      </PageFrame>
    );
  }

  if (!caseData || !session) {
    return (
      <PageFrame>
        <LoadingState
          label={
            caseLoading || sessionLoading
              ? "Opening the investigation room…"
              : "Preparing the case file…"
          }
        />
      </PageFrame>
    );
  }

  if (session.status === "completed") {
    return (
      <PageFrame>
        <LoadingState label="Opening the closed case file…" />
      </PageFrame>
    );
  }

  const viewedIds = new Set(session.viewedEvidenceIds);
  const reviewedPercent = percent(viewedIds.size, caseData.evidenceCount);
  const projectedScore = Math.max(0, CORRECT_BASE_SCORE - session.hintsUsed * HINT_PENALTY);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-paper/45 hover:text-paper/75"
      >
        <ArrowLeftIcon className="size-3.5" />
        Leave the case room
      </Link>

      {sessionProblem ? (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 border border-signal/40 bg-signal/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-2">
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-signal-bright" />
            <p className="text-xs leading-relaxed text-paper/75">
              {sessionProblem instanceof ApiError
                ? sessionProblem.message
                : "This investigation session is no longer available."}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={restartSession}>
            Start a new session
          </Button>
        </div>
      ) : null}

      <CaseHeader caseData={caseData} />

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20.5rem]">
        <div className="min-w-0 space-y-6">
          {progressError ? (
            <div
              role="alert"
              className="flex gap-2 border border-signal/30 bg-signal/[0.06] px-4 py-3"
            >
              <AlertIcon className="mt-0.5 size-4 shrink-0 text-signal-bright" />
              <p className="text-xs leading-relaxed text-paper/65">
                The exhibit opened, but the review could not be recorded
                {progressError instanceof ApiError ? `: ${progressError.message}` : "."}
              </p>
            </div>
          ) : null}

          <SuspectsPanel
            suspects={caseData.suspects}
            selectedId={selectedSuspectId}
            onSelect={setSelectedSuspectId}
            onAccuse={openAccusation}
          />

          <EvidenceBrowser
            evidence={evidence}
            selectedId={selectedEvidenceId}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            viewedIds={viewedIds}
            timezone={caseData.timezone}
            onSelect={(evidenceId) => {
              void openEvidence(evidenceId);
            }}
            onRetryDetail={retryDetail}
          />
        </div>

        <aside className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Kicker>Investigation status</Kicker>
                <h2 className="mt-1 font-display text-xl text-paper">Case in progress</h2>
              </div>
              <span className="grid size-9 place-items-center border border-brass/35 bg-brass/5 text-brass-bright">
                <EyeIcon className="size-4" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-paper/55">
                {viewedIds.size} of {caseData.evidenceCount} exhibits reviewed
              </span>
              <span className="font-mono text-[0.64rem] text-brass/80">{reviewedPercent}%</span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden bg-white/10"
              role="progressbar"
              aria-label="Evidence reviewed"
              aria-valuemin={0}
              aria-valuemax={caseData.evidenceCount}
              aria-valuenow={viewedIds.size}
            >
              <div
                className="h-full bg-brass/80 transition-[width] duration-300"
                style={{ width: `${reviewedPercent}%` }}
              />
            </div>
            <dl className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[0.68rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-paper/40">Hints used</dt>
                <dd className="font-mono text-paper/65">
                  {session.hintsUsed} / {session.hintLimit}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-paper/40">Session expires</dt>
                <dd className="font-mono text-paper/65">
                  {formatSessionExpiry(session.expiresAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-paper/40">Accusations left</dt>
                <dd className="font-mono text-paper/65">1</dd>
              </div>
            </dl>
            <p className="mt-3 text-[0.66rem] leading-relaxed text-paper/35">
              Progress is tied to a guest credential in this browser. Clearing cookies can
              end the session.
            </p>
          </Panel>

          <TimelinePanel timeline={caseData.timeline} timezone={caseData.timezone} />

          <HintsPanel
            hintsUsed={session.hintsUsed}
            hintLimit={session.hintLimit}
            hints={hints}
            pending={hintPending}
            error={hintError}
            onRequest={() => {
              void requestHint();
            }}
          />

          <Panel className="border-signal/25 p-5">
            <Kicker className="text-signal-bright/80">Final action</Kicker>
            <h2 className="mt-1 font-display text-xl text-paper">Close the case</h2>
            <p className="mt-2 text-xs leading-relaxed text-paper/55">
              You get one accusation. A correct answer scores{" "}
              <span className="font-mono text-paper/80">{projectedScore}</span> points after
              hints; an incorrect answer scores zero. The solution is revealed either way.
            </p>
            <Button
              type="button"
              variant="danger"
              className="mt-4 w-full"
              onClick={() => openAccusation()}
              icon={<ScaleIcon className="size-4" />}
            >
              Review and accuse
            </Button>
            <p className="mt-2 text-center text-[0.62rem] text-paper/30">
              You may still review every exhibit before confirming.
            </p>
          </Panel>

          <div className="flex items-start gap-2 px-1 text-[0.66rem] leading-relaxed text-paper/35">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Times use the case timezone, {caseData.timezone}. The app never sends the
              canonical solution before the accusation.
            </p>
          </div>
        </aside>
      </div>

      <FictionNotice className="mt-8">{caseData.fictionNotice}</FictionNotice>

      <AccusationDialog
        open={accuseOpen}
        suspects={caseData.suspects}
        selectedSuspectId={accusedSuspectId}
        onSelectSuspect={setAccusedSuspectId}
        onClose={closeAccusation}
        onConfirm={() => {
          void confirmAccusation();
        }}
        pending={accusationPending}
        error={accusationError}
      />
    </div>
  );
}

function CaseHeader({ caseData }: { caseData: PublicCase }) {
  return (
    <header className="mt-5 overflow-hidden border border-white/10 bg-panel/55">
      <div className="case-grid border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brass">{CATEGORY_LABELS[caseData.category]}</Badge>
              <Badge tone="neutral">{DIFFICULTY_LABELS[caseData.difficulty]}</Badge>
              {caseData.isSample ? <Badge tone="paper">Sample file</Badge> : null}
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-paper sm:text-4xl lg:text-5xl">
              {caseData.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper/60">
              {caseData.summary}
            </p>
          </div>
          <span className="stamp hidden shrink-0 px-3 py-1.5 font-mono text-[0.58rem] uppercase sm:block">
            Open file
          </span>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-3">
        <div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
            Incident location
          </p>
          <p className="mt-1.5 text-sm text-paper/80">{caseData.incident.location}</p>
        </div>
        <div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
            Recorded
          </p>
          <p className="mt-1.5 text-sm text-paper/80">
            <time dateTime={caseData.incident.occurredAt}>
              {formatDateTime(caseData.incident.occurredAt, caseData.timezone)}
            </time>
          </p>
        </div>
        <div className="px-5 py-4 sm:px-7">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-paper/35">
            Exhibits / suspects
          </p>
          <p className="mt-1.5 text-sm text-paper/80">
            {caseData.evidenceCount} exhibits · {caseData.suspects.length} suspects
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-4 sm:px-7">
        <p className="max-w-4xl text-xs leading-relaxed text-paper/55">
          <span className="font-semibold text-paper/75">Incident: </span>
          {caseData.incident.description}
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer list-none font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass/75 hover:text-brass-bright">
            Case rules ({caseData.caseRules.length})
          </summary>
          <ul className="mt-2 grid gap-1.5">
            {caseData.caseRules.map((rule) => (
              <li key={rule} className="flex gap-2 text-xs leading-relaxed text-paper/50">
                <FileIcon className="mt-0.5 size-3 shrink-0 text-paper/30" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </header>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">{children}</div>
  );
}
