import type { SuspectView } from "@amr/shared";
import { initials } from "../../lib/format";
import { Badge, Kicker, Panel } from "../../components/Panel";
import { ScaleIcon, UserIcon } from "../../components/Icons";
import { buttonClasses } from "../../components/button-classes";

export function SuspectsPanel({
  suspects,
  selectedId,
  onSelect,
  onAccuse,
}: {
  suspects: SuspectView[];
  selectedId: string | null;
  onSelect: (suspectId: string) => void;
  onAccuse: (suspectId: string) => void;
}) {
  const selected = suspects.find((suspect) => suspect.id === selectedId) ?? suspects[0];

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <Kicker>Persons of interest</Kicker>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-paper">Suspects</h2>
          <p className="text-xs text-paper/45">{suspects.length} people remain inside the file</p>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1" aria-label="Suspect list">
            {suspects.map((suspect) => {
              const active = suspect.id === selected?.id;
              return (
                <li key={suspect.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(suspect.id)}
                    className={[
                      "flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-brass/60 bg-brass/10"
                        : "border-white/10 bg-transparent hover:border-brass/30 hover:bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        "grid size-9 shrink-0 place-items-center rounded-full border font-mono text-[0.66rem]",
                        active
                          ? "border-brass/60 bg-brass/15 text-brass-bright"
                          : "border-white/15 text-paper/55",
                      ].join(" ")}
                    >
                      {initials(suspect.displayName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-paper">
                        {suspect.displayName}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.7rem] text-paper/45">
                        {suspect.role}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selected ? (
          <article className="min-w-0 p-5 sm:p-6" aria-label={`Profile of ${selected.displayName}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full border border-brass/40 bg-brass/5 font-mono text-sm text-brass-bright">
                  {initials(selected.displayName)}
                </span>
                <div>
                  <h3 className="font-display text-2xl leading-tight text-paper">
                    {selected.displayName}
                  </h3>
                  <p className="text-xs text-brass/80">{selected.role}</p>
                </div>
              </div>
              <Badge tone="neutral">
                <UserIcon className="size-3" />
                Suspect
              </Badge>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-paper/70">{selected.profile}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <section className="border border-white/10 bg-ink/30 p-3.5">
                <h4 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass/75">
                  Possible motive
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-paper/65">
                  {selected.motiveSummary}
                </p>
              </section>
              <section className="border border-white/10 bg-ink/30 p-3.5">
                <h4 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass/75">
                  Opportunity
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-paper/65">
                  {selected.opportunitySummary}
                </p>
              </section>
            </div>

            <section className="mt-5">
              <h4 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass/75">
                Statement to security
              </h4>
              <blockquote className="mt-2 border-l-2 border-brass/40 pl-4 text-sm leading-relaxed text-paper/80">
                “{selected.publicStatement}”
              </blockquote>
            </section>

            {selected.relationships.length > 0 ? (
              <section className="mt-5">
                <h4 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass/75">
                  Known connections
                </h4>
                <ul className="mt-2 grid gap-1.5">
                  {selected.relationships.map((relationship) => (
                    <li
                      key={`${relationship.suspectId}-${relationship.relationship}`}
                      className="flex flex-wrap gap-x-2 text-xs leading-relaxed text-paper/55"
                    >
                      <span className="font-medium text-paper/75">
                        {relationship.displayName}
                      </span>
                      <span>{relationship.relationship}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => onAccuse(selected.id)}
              className={buttonClasses("secondary", "mt-6")}
            >
              <ScaleIcon className="size-4" />
              Name {selected.displayName.split(" ")[0]} in an accusation
            </button>
          </article>
        ) : (
          <div className="p-6 text-sm text-paper/50">No suspects are attached to this case.</div>
        )}
      </div>
    </Panel>
  );
}
