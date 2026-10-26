import type { PublicTimelineEvent } from "@amr/shared";
import { formatTimelineTime } from "../../lib/format";
import { Kicker, Panel } from "../../components/Panel";
import { ClockIcon } from "../../components/Icons";

export function TimelinePanel({
  timeline,
  timezone,
}: {
  timeline: PublicTimelineEvent[];
  timezone: string;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <Kicker>Established movements</Kicker>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-paper">Timeline</h2>
          <ClockIcon className="size-4 text-brass/60" />
        </div>
        <p className="mt-1 text-[0.68rem] leading-relaxed text-paper/40">
          Public record · times in {timezone.replace("America/", "")}
        </p>
      </div>

      {timeline.length === 0 ? (
        <div className="px-5 py-6 text-sm text-paper/50">No public timeline is available.</div>
      ) : (
        <ol className="divide-y divide-white/[0.06] px-5">
          {timeline.map((event) => (
            <li key={event.eventId} className="py-3.5">
              <div className="flex items-baseline gap-3">
                <time
                  dateTime={event.at}
                  className="shrink-0 font-mono text-xs text-brass-bright"
                >
                  {formatTimelineTime(event.at, timezone)}
                </time>
                <span className="min-w-0 text-[0.68rem] uppercase tracking-[0.08em] text-paper/40">
                  {event.location}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-paper/70">
                {event.description}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
