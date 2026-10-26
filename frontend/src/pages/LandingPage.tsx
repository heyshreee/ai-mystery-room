import { Link } from "react-router-dom";
import { FICTION_NOTICE } from "@amr/shared";
import { ArrowRightIcon, ClockIcon, FileIcon, LockIcon, ScaleIcon, SparkIcon } from "../components/Icons";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/button-classes";
import { Badge, Divider, Kicker, Panel } from "../components/Panel";
import { ErrorPanel } from "../components/ErrorPanel";
import { useStartSampleCase } from "../hooks/useStartSampleCase";

export function LandingPage() {
  const sample = useStartSampleCase();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-10 sm:px-6 sm:pt-16 lg:px-8">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div className="animate-enter">
          <Kicker>Interactive detective fiction</Kicker>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] text-paper sm:text-5xl lg:text-6xl">
            A mystery that
            <span className="text-brass-bright"> keeps its receipts.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/65 sm:text-lg">
            Turn a scenario into a fictional case file: suspects with something to hide,
            records that disagree, and one answer the evidence can actually support.
            Read the file. Cross-reference the lies. Name the culprit.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/create" className={buttonClasses("primary", "sm:px-5")}>
              <SparkIcon className="size-4" />
              Create a Mystery
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={sample.start}
              loading={sample.pending}
              loadingLabel="Preparing the file…"
              icon={<FileIcon className="size-4" />}
            >
              Play the sample case
            </Button>
          </div>
          <p className="mt-3 text-xs text-paper/40">
            No account required. The hand-authored sample runs without an AI provider.
          </p>

          {sample.error ? (
            <ErrorPanel
              title="The sample file could not be prepared"
              error={sample.error}
              onRetry={sample.start}
              retryLabel="Try the sample again"
              className="mt-6"
            />
          ) : null}
        </div>

        <div className="relative animate-enter-delayed">
          <div
            aria-hidden="true"
            className="absolute -inset-3 -z-10 border border-brass/10 bg-brass/[0.02]"
          />
          <Panel className="relative overflow-hidden">
            <div className="case-grid relative border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-brass/75">
                    Halcyon House · Sample file 001
                  </p>
                  <h2 className="mt-2 font-display text-3xl leading-tight text-paper sm:text-4xl">
                    The Meridian at Midnight
                  </h2>
                </div>
                <span className="stamp shrink-0 px-2 py-1 font-mono text-[0.54rem] uppercase">
                  Sample
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="brass">Theft</Badge>
                <Badge tone="neutral">Medium difficulty</Badge>
                <Badge tone="neutral">
                  <ClockIcon className="size-3" /> One evening
                </Badge>
              </div>
            </div>

            <div className="relative px-5 py-5 sm:px-6">
              <p className="text-sm leading-relaxed text-paper/65">
                A jeweled astronomical sphere vanishes from a sealed museum gallery during
                a private preview. The public doors were watched. The service corridors
                were not.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
                {[
                  ["4", "Suspects"],
                  ["8", "Exhibits"],
                  ["1", "Final answer"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-display text-2xl text-brass-bright">{value}</p>
                    <p className="mt-0.5 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-paper/40">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2" aria-hidden="true">
                {[92, 78, 86, 64].map((width, index) => (
                  <div
                    key={index}
                    className="h-2 bg-white/[0.055]"
                    style={{ width: `${width}%` }}
                  />
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <LockIcon className="size-3.5 text-signal/70" />
                  <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-paper/30">
                    Solution sealed until accusation
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={sample.start}
                disabled={sample.pending}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brass-bright underline decoration-brass/40 underline-offset-4 hover:text-brass disabled:text-paper/30"
              >
                Open the sample file
                <ArrowRightIcon className="size-3.5" />
              </button>
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="how-it-works">
        <div className="max-w-2xl">
          <Kicker>How an investigation works</Kicker>
          <h2 id="how-it-works" className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            Three moves, one closed case.
          </h2>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileIcon,
              label: "01 · Read the record",
              title: "Build the timeline",
              body: "Start with the incident, the people, and the established movements. Every exhibit has a source, a time, and a reason to doubt it.",
            },
            {
              icon: ScaleIcon,
              label: "02 · Find the contradiction",
              title: "Cross-reference everything",
              body: "Compare credentials, camera logs, statements, and chat messages. The gap is usually where two records disagree.",
            },
            {
              icon: LockIcon,
              label: "03 · Make it count",
              title: "One final accusation",
              body: "The server scores the answer. The culprit, reasoning, and supporting exhibits appear only after the case is closed.",
            },
          ].map((step) => (
            <Panel key={step.label} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-10 place-items-center border border-brass/35 bg-brass/5 text-brass-bright">
                  <step.icon className="size-5" />
                </span>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-paper/35">
                  {step.label}
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl text-paper">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/55">{step.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 border-y border-white/10 py-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <Kicker>What the room protects</Kicker>
          <h2 className="mt-3 font-display text-3xl text-paper">
            Designed for honest puzzles.
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="font-display text-lg text-paper">Evidence before answers</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
              Public case data never includes the culprit, hidden explanation, or solution
              clues. The reveal is a server decision made after the accusation.
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg text-paper">Hints that reason</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
              Hints point at inconsistencies instead of naming a suspect. Three are
              available, each costs ten points, and the limit is enforced server-side.
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg text-paper">Fiction, clearly labeled</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
              People, messages, images, and records are simulated for the game. Nothing in
              a case file describes a real person or a real event.
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg text-paper">A build you can run</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-paper/55">
              The deterministic sample needs no model key. Live AI generation is a later
              phase and is not connected in this build.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <Panel className="relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-10 size-40 rounded-full border border-brass/10"
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Kicker>No key. No setup.</Kicker>
              <h2 className="mt-2 font-display text-2xl text-paper sm:text-3xl">
                Play the hand-authored sample now.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-paper/55">
                A complete investigation with four suspects, eight exhibits, three
                progressive hints, and a server-scored reveal.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={sample.start} loading={sample.pending}>
                <FileIcon className="size-4" />
                Play the sample case
              </Button>
              <Link to="/create" className={buttonClasses("secondary")}>
                Create a Mystery
              </Link>
            </div>
          </div>
        </Panel>
      </section>

      <div className="mt-10">
        <Divider />
        <p className="mt-4 max-w-4xl text-[0.7rem] leading-relaxed text-paper/35">
          {FICTION_NOTICE}
        </p>
      </div>
    </div>
  );
}
