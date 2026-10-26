import { useMemo, useState } from "react";
import {
  EVIDENCE_TYPE_LABELS,
  RELIABILITY_LABELS,
  type EvidenceDetail,
  type EvidenceSummary,
  type EvidenceType,
} from "@amr/shared";
import { cn, formatDateTime } from "../../lib/format";
import { Badge, Kicker, Panel } from "../../components/Panel";
import {
  ChatIcon,
  CheckIcon,
  EyeIcon,
  FileIcon,
  ImageIcon,
  TerminalIcon,
} from "../../components/Icons";
import { ErrorPanel } from "../../components/ErrorPanel";
import { LoadingState } from "../../components/Spinner";
import { FictionNotice } from "../../components/FictionNotice";
import { EvidenceContentView } from "../evidence/EvidenceContentView";

type TypeFilter = EvidenceType | "all";
type ViewFilter = "all" | "viewed" | "unviewed";

export function EvidenceBrowser({
  evidence,
  selectedId,
  detail,
  detailLoading,
  detailError,
  viewedIds,
  timezone,
  onSelect,
  onRetryDetail,
}: {
  evidence: EvidenceSummary[];
  selectedId: string | null;
  detail: EvidenceDetail | null;
  detailLoading: boolean;
  detailError: unknown;
  viewedIds: Set<string>;
  timezone: string;
  onSelect: (evidenceId: string) => void;
  onRetryDetail: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  const availableTypes = useMemo(() => {
    const types = new Set<EvidenceType>();
    for (const item of evidence) {
      types.add(item.type);
    }
    return [...types];
  }, [evidence]);

  const filtered = useMemo(
    () =>
      evidence.filter((item) => {
        if (typeFilter !== "all" && item.type !== typeFilter) {
          return false;
        }
        const viewed = viewedIds.has(item.id);
        if (viewFilter === "viewed" && !viewed) {
          return false;
        }
        if (viewFilter === "unviewed" && viewed) {
          return false;
        }
        return true;
      }),
    [evidence, typeFilter, viewFilter, viewedIds],
  );

  const filtersActive = typeFilter !== "all" || viewFilter !== "all";

  return (
    <Panel className="overflow-hidden" as="section">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <Kicker>Exhibit room</Kicker>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-paper">Evidence</h2>
          <p className="text-xs text-paper/45">
            {viewedIds.size} of {evidence.length} reviewed
          </p>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="border-b border-white/10 xl:border-b-0 xl:border-r">
          <div className="grid gap-2 border-b border-white/[0.06] p-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="grid gap-1">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper/40">
                Filter by type
              </span>
              <select
                className="field"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              >
                <option value="all">All evidence types</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {EVIDENCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper/40">
                Filter by review status
              </span>
              <select
                className="field"
                value={viewFilter}
                onChange={(event) => setViewFilter(event.target.value as ViewFilter)}
              >
                <option value="all">All exhibits</option>
                <option value="unviewed">Not yet reviewed</option>
                <option value="viewed">Reviewed</option>
              </select>
            </label>
            {filtersActive ? (
              <button
                type="button"
                className="justify-self-start text-left text-xs text-brass/85 underline decoration-brass/40 underline-offset-4 hover:text-brass-bright"
                onClick={() => {
                  setTypeFilter("all");
                  setViewFilter("all");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <p className="border-b border-white/[0.06] px-4 py-2 text-[0.68rem] text-paper/40">
            Show {filtered.length} of {evidence.length} exhibits
          </p>

          {filtered.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-paper/60">No exhibits match these filters.</p>
              <button
                type="button"
                className="mt-2 text-xs text-brass underline decoration-brass/40 underline-offset-4 hover:text-brass-bright"
                onClick={() => {
                  setTypeFilter("all");
                  setViewFilter("all");
                }}
              >
                Show every exhibit
              </button>
            </div>
          ) : (
            <ul
              className="max-h-[42rem] space-y-1.5 overflow-y-auto p-3 scrollbar-thin"
              aria-label="Evidence exhibits"
            >
              {filtered.map((item) => {
                const active = item.id === selectedId;
                const viewed = viewedIds.has(item.id);
                const Icon = iconForType(item.type);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-controls="evidence-detail"
                      onClick={() => onSelect(item.id)}
                      data-selected={active ? "true" : "false"}
                      className="evidence-card w-full p-3.5 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 grid size-8 shrink-0 place-items-center border",
                            active
                              ? "border-brass/50 bg-brass/10 text-brass-bright"
                              : "border-white/10 text-paper/45",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-brass/75">
                              EXH-{String(item.exhibitNumber).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-paper/35">
                              {EVIDENCE_TYPE_LABELS[item.type]}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm font-medium leading-snug text-paper">
                            {item.title}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[0.7rem] leading-relaxed text-paper/45">
                            {item.publicDescription}
                          </span>
                          <span className="mt-2 flex items-center gap-1.5 text-[0.64rem] text-paper/40">
                            {viewed ? (
                              <>
                                <CheckIcon className="size-3 text-moss" />
                                <span>Reviewed</span>
                              </>
                            ) : (
                              <>
                                <EyeIcon className="size-3" />
                                <span>Not yet reviewed</span>
                              </>
                            )}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div id="evidence-detail" className="min-w-0 p-5 sm:p-6" aria-live="polite">
          {detailLoading ? (
            <div className="py-10">
              <LoadingState label="Pulling the exhibit from the file…" />
            </div>
          ) : detailError ? (
            <ErrorPanel
              title="This exhibit could not be opened"
              error={detailError}
              onRetry={onRetryDetail}
              className="border-signal/25"
            />
          ) : detail ? (
            <EvidenceDetailView detail={detail} timezone={timezone} />
          ) : (
            <div className="flex h-full min-h-64 flex-col items-start justify-center py-10">
              <span className="grid size-12 place-items-center border border-brass/30 bg-brass/5 text-brass/70">
                <FileIcon className="size-6" />
              </span>
              <h3 className="mt-4 font-display text-xl text-paper">Select an exhibit</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/50">
                Open an exhibit to read its full contents. Reviewed exhibits are recorded
                against your investigation session.
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function EvidenceDetailView({
  detail,
  timezone,
}: {
  detail: EvidenceDetail;
  timezone: string;
}) {
  return (
    <article>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-brass/80">
              Exhibit {String(detail.exhibitNumber).padStart(2, "0")}
            </span>
            <Badge tone="neutral">{EVIDENCE_TYPE_LABELS[detail.type]}</Badge>
          </div>
          <h3 className="mt-2 font-display text-2xl leading-tight text-paper">{detail.title}</h3>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-paper/60">{detail.publicDescription}</p>

      <dl className="mt-4 grid gap-x-5 gap-y-2 border-y border-white/10 py-3 text-xs sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/35">
            Source
          </dt>
          <dd className="text-paper/65">{detail.sourceLabel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/35">
            Reliability
          </dt>
          <dd className="text-paper/65">{RELIABILITY_LABELS[detail.reliability]}</dd>
        </div>
        {detail.occurredAt ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/35">
              Recorded
            </dt>
            <dd className="text-paper/65">
              <time dateTime={detail.occurredAt}>
                {formatDateTime(detail.occurredAt, timezone)}
              </time>
            </dd>
          </div>
        ) : (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-paper/35">
              Recorded
            </dt>
            <dd className="text-paper/50">Time not established</dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        <EvidenceContentView content={detail.content} altText={detail.altText} />
      </div>

      <FictionNotice className="mt-6">{detail.fictionNotice}</FictionNotice>
    </article>
  );
}

function iconForType(type: EvidenceType) {
  switch (type) {
    case "chat_transcript":
      return ChatIcon;
    case "image":
      return ImageIcon;
    case "cctv_log":
    case "cctv_transcript":
    case "access_log":
      return TerminalIcon;
    default:
      return FileIcon;
  }
}
