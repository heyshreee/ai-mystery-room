import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FileIcon, RefreshIcon, SparkIcon } from "../components/Icons";
import { buttonClasses } from "../components/button-classes";
import { ErrorPanel } from "../components/ErrorPanel";
import { LoadingState } from "../components/Spinner";
import { Kicker, Panel } from "../components/Panel";
import { FictionNotice } from "../components/FictionNotice";
import { useStartSampleCase } from "../hooks/useStartSampleCase";

export function SamplePage() {
  const sample = useStartSampleCase();
  const startSample = sample.start;
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void startSample();
  }, [startSample]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <Panel className="overflow-hidden">
        <div className="case-grid border-b border-white/10 px-6 py-6 sm:px-8">
          <Kicker>Loading sample file 001</Kicker>
          <h1 className="mt-2 font-display text-3xl text-paper sm:text-4xl">
            The Meridian at Midnight
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-paper/55">
            A sealed gallery, a missing astronomical sphere, and four people who were
            inside when the doors locked. The file is being prepared.
          </p>
        </div>
        <div className="px-6 py-8 sm:px-8">
          {sample.error ? (
            <ErrorPanel
              title="The sample file could not be opened"
              error={sample.error}
              onRetry={sample.start}
              retryLabel="Try again"
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link to="/create" className={buttonClasses("secondary")}>
                  <SparkIcon className="size-4" />
                  Create a mystery instead
                </Link>
                <Link to="/" className={buttonClasses("ghost")}>
                  Return home
                </Link>
              </div>
            </ErrorPanel>
          ) : (
            <div className="space-y-5">
              <LoadingState
                label={
                  sample.pending ? "Preparing the case file…" : "Opening the investigation room…"
                }
              />
              <div className="flex items-center gap-3 border border-white/10 bg-ink/25 px-4 py-3 text-xs text-paper/45">
                <FileIcon className="size-4 shrink-0 text-brass/70" />
                <p>
                  Building the sample case and starting a guest investigation session. No
                  AI provider is contacted.
                </p>
              </div>
              <button
                type="button"
                onClick={sample.start}
                disabled={sample.pending}
                className="inline-flex items-center gap-1.5 text-xs text-paper/40 hover:text-paper/70 disabled:text-paper/20"
              >
                <RefreshIcon className="size-3.5" />
                Retry if this takes too long
              </button>
            </div>
          )}
        </div>
      </Panel>
      <FictionNotice className="mt-5" />
    </div>
  );
}
