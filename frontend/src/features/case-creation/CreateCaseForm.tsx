import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  DIFFICULTY_LABELS,
  DIFFICULTY_VALUES,
  EVIDENCE_PREFERENCE_VALUES,
  EVIDENCE_TYPE_LABELS,
  FICTION_NOTICE,
  MAX_EVIDENCE_PREFERENCES,
  SCENARIO_MAX_LENGTH,
  SCENARIO_MIN_LENGTH,
  type Category,
  type CustomCaseRequest,
  type Difficulty,
  type EvidencePreference,
  type GenerationStatusView,
} from "@amr/shared";
import { api, ApiError } from "../../lib/api";
import {
  fieldErrorsFromApi,
  validateCaseForm,
  type CaseFormErrors,
  type CaseFormField,
  type CaseFormValues,
} from "../../lib/case-form";
import {
  GENERATION_POLL_INTERVAL_MS,
  isGenerationInFlight,
  isGenerationStatusView,
} from "../../lib/generation";
import { createRequestKey } from "../../lib/id";
import { Button } from "../../components/Button";
import { Panel, Kicker, Divider } from "../../components/Panel";
import {
  AlertIcon,
  ArrowRightIcon,
  FileIcon,
  LockIcon,
  SparkIcon,
} from "../../components/Icons";
import { ErrorPanel } from "../../components/ErrorPanel";
import { FictionNotice } from "../../components/FictionNotice";
import { useStartSampleCase } from "../../hooks/useStartSampleCase";
import { GenerationProgressPanel } from "./GenerationProgressPanel";

const INITIAL_VALUES: CaseFormValues = {
  scenario: "",
  category: "theft",
  difficulty: "medium",
  evidencePreferences: [],
};

const FIELD_ORDER: CaseFormField[] = [
  "scenario",
  "category",
  "difficulty",
  "evidencePreferences",
];

export function CreateCaseForm() {
  const navigate = useNavigate();
  const sample = useStartSampleCase();
  const [values, setValues] = useState<CaseFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CaseFormErrors>({});
  const [pending, setPending] = useState(false);
  const [submissionError, setSubmissionError] = useState<unknown>(null);
  const [generation, setGeneration] = useState<GenerationStatusView | null>(null);
  const [pollError, setPollError] = useState<unknown>(null);
  const [pollNonce, setPollNonce] = useState(0);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);
  const submitInFlight = useRef(false);

  const generationInFlight = generation ? isGenerationInFlight(generation) : false;
  const formLocked = pending || generation !== null;
  const generationId = generationInFlight ? (generation?.id ?? null) : null;

  useEffect(() => {
    if (!generationId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const status = await api.getGenerationStatus(generationId, controller.signal);
        if (cancelled) {
          return;
        }
        setPollError(null);
        setGeneration(status);
        if (isGenerationInFlight(status)) {
          timer = setTimeout(() => {
            void poll();
          }, GENERATION_POLL_INTERVAL_MS);
        } else if (status.status === "failed") {
          // A definitive failure must not be replayed with the same key.
          requestRef.current = null;
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) {
          return;
        }
        setPollError(error);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [generationId, pollNonce]);

  useEffect(() => {
    if (generation?.status === "ready") {
      navigate(`/case/${generation.caseId}`);
    }
  }, [generation, navigate]);

  const updateValue = <K extends keyof CaseFormValues>(key: K, value: CaseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSubmissionError(null);
  };

  const togglePreference = (preference: EvidencePreference) => {
    setValues((current) => {
      const selected = current.evidencePreferences.includes(preference);
      if (selected) {
        return {
          ...current,
          evidencePreferences: current.evidencePreferences.filter(
            (entry) => entry !== preference,
          ),
        };
      }
      if (current.evidencePreferences.length >= MAX_EVIDENCE_PREFERENCES) {
        return current;
      }
      return {
        ...current,
        evidencePreferences: [...current.evidencePreferences, preference],
      };
    });
    setErrors((current) => {
      if (!current.evidencePreferences) {
        return current;
      }
      const next = { ...current };
      delete next.evidencePreferences;
      return next;
    });
  };

  const focusFirstError = (nextErrors: CaseFormErrors) => {
    const first = FIELD_ORDER.find((field) => nextErrors[field]);
    if (!first) {
      return;
    }
    const element = document.getElementById(`case-${first}`);
    element?.focus();
  };

  const submitBrief = async (
    data: CustomCaseRequest,
    options: { freshKey?: boolean } = {},
  ) => {
    if (submitInFlight.current) {
      return;
    }
    submitInFlight.current = true;

    const payload = JSON.stringify(data);
    if (
      options.freshKey ||
      !requestRef.current ||
      requestRef.current.payload !== payload
    ) {
      requestRef.current = { payload, key: createRequestKey("case") };
    }

    setPending(true);
    setSubmissionError(null);
    setPollError(null);

    try {
      const result = await api.createCustomCase(data, requestRef.current.key);
      if (isGenerationStatusView(result)) {
        setGeneration(result);
        if (result.status === "failed") {
          requestRef.current = null;
        }
      } else {
        navigate(`/case/${result.case.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = fieldErrorsFromApi(error.details);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          focusFirstError(fieldErrors);
        }
      }
      setSubmissionError(error);
    } finally {
      submitInFlight.current = false;
      setPending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formLocked) {
      return;
    }

    const validation = validateCaseForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }

    setErrors({});
    setGeneration(null);
    setPollError(null);
    await submitBrief(validation.data);
  };

  const retryGeneration = () => {
    const validation = validateCaseForm(values);
    if (!validation.ok) {
      setGeneration(null);
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }
    setErrors({});
    setGeneration(null);
    setPollError(null);
    requestRef.current = null;
    void submitBrief(validation.data, { freshKey: true });
  };

  const changeBrief = () => {
    setGeneration(null);
    setPollError(null);
    setSubmissionError(null);
    requestRef.current = null;
    setTimeout(() => {
      document.getElementById("case-scenario")?.focus();
    }, 0);
  };

  const retryPoll = () => {
    setPollError(null);
    setPollNonce((value) => value + 1);
  };

  const scenarioTooLong = values.scenario.length > SCENARIO_MAX_LENGTH;
  const atPreferenceLimit =
    values.evidencePreferences.length >= MAX_EVIDENCE_PREFERENCES;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div>
        <div className="mb-5 flex gap-3 border border-white/10 bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-paper/65">
          <LockIcon className="mt-0.5 size-4 shrink-0 text-brass/80" />
          <p>
            <span className="font-semibold text-paper/85">
              Every custom case is fictional and assembled on the server.
            </span>{" "}
            A case file is published only after its suspects, timeline, clues, and
            solution pass validation. If generation fails, the complete sample case stays
            playable.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Create a mystery"
          aria-busy={formLocked || undefined}
        >
          <Panel className="overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <Kicker>Case brief</Kicker>
              <h2 className="mt-1 font-display text-2xl text-paper">
                What should the room investigate?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-paper/45">
                Describe a fictional situation. Specific objects, places, and grudges
                produce a cleaner case than a genre label alone.
              </p>
            </div>

            <div className="space-y-6 px-5 py-5 sm:px-6">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="case-scenario"
                    className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80"
                  >
                    Scenario
                  </label>
                  <span
                    className={
                      scenarioTooLong
                        ? "font-mono text-[0.64rem] text-signal-bright"
                        : "font-mono text-[0.64rem] text-paper/40"
                    }
                  >
                    {values.scenario.length.toLocaleString("en-US")} /{" "}
                    {SCENARIO_MAX_LENGTH.toLocaleString("en-US")}
                  </span>
                </div>
                <textarea
                  id="case-scenario"
                  className="field mt-2 min-h-44 resize-y"
                  value={values.scenario}
                  onChange={(event) => updateValue("scenario", event.target.value)}
                  aria-invalid={errors.scenario ? "true" : undefined}
                  aria-describedby={
                    errors.scenario ? "case-scenario-error case-scenario-help" : "case-scenario-help"
                  }
                  placeholder="Example: A signed first edition vanishes from a locked rare-books room during a private reading. Three collectors were inside; one had already tried to buy it twice."
                  disabled={formLocked}
                />
                <p id="case-scenario-help" className="mt-1.5 text-[0.68rem] text-paper/35">
                  {SCENARIO_MIN_LENGTH}–{SCENARIO_MAX_LENGTH.toLocaleString("en-US")}{" "}
                  characters. Fictional scenarios only.
                </p>
                {errors.scenario ? (
                  <p id="case-scenario-error" className="mt-1 text-xs text-signal-bright">
                    {errors.scenario}
                  </p>
                ) : null}
              </div>

              <Divider />

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="case-category"
                    className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80"
                  >
                    Category
                  </label>
                  <select
                    id="case-category"
                    className="field mt-2"
                    value={values.category}
                    onChange={(event) =>
                      updateValue("category", event.target.value as Category)
                    }
                    aria-invalid={errors.category ? "true" : undefined}
                    aria-describedby={errors.category ? "case-category-error" : undefined}
                    disabled={formLocked}
                  >
                    {CATEGORY_VALUES.map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                  {errors.category ? (
                    <p id="case-category-error" className="mt-1 text-xs text-signal-bright">
                      {errors.category}
                    </p>
                  ) : null}
                </div>

                <fieldset
                  id="case-difficulty"
                  tabIndex={-1}
                  aria-describedby={errors.difficulty ? "case-difficulty-error" : undefined}
                  disabled={formLocked}
                >
                  <legend className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
                    Difficulty
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {DIFFICULTY_VALUES.map((difficulty) => (
                      <label key={difficulty} className="choice justify-center px-2 py-2.5">
                        <input
                          type="radio"
                          name="difficulty"
                          value={difficulty}
                          checked={values.difficulty === difficulty}
                          onChange={() =>
                            updateValue("difficulty", difficulty as Difficulty)
                          }
                          className="sr-only"
                          disabled={formLocked}
                        />
                        <span className="text-center text-xs text-paper/75">
                          {DIFFICULTY_LABELS[difficulty]}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.difficulty ? (
                    <p id="case-difficulty-error" className="mt-1 text-xs text-signal-bright">
                      {errors.difficulty}
                    </p>
                  ) : null}
                </fieldset>
              </div>

              <Divider />

              <fieldset
                id="case-evidencePreferences"
                tabIndex={-1}
                aria-describedby={
                  errors.evidencePreferences ? "case-preference-error" : "case-preference-help"
                }
                disabled={formLocked}
              >
                <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
                  <span>Evidence preferences</span>
                  <span className="font-mono text-[0.62rem] normal-case tracking-normal text-paper/35">
                    {values.evidencePreferences.length} / {MAX_EVIDENCE_PREFERENCES}
                  </span>
                </legend>
                <p id="case-preference-help" className="mt-1 text-[0.68rem] text-paper/35">
                  Optional. Choose the kinds of exhibits you would like to see. The case
                  may use others to stay solvable.
                </p>
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {EVIDENCE_PREFERENCE_VALUES.map((preference) => {
                    const checked = values.evidencePreferences.includes(preference);
                    const disabled = !checked && atPreferenceLimit;
                    return (
                      <label
                        key={preference}
                        className={[
                          "choice items-center",
                          disabled ? "cursor-not-allowed opacity-45" : "",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          value={preference}
                          checked={checked}
                          disabled={disabled || formLocked}
                          onChange={() => togglePreference(preference)}
                        />
                        <span className="text-xs text-paper/70">
                          {EVIDENCE_TYPE_LABELS[preference]}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.evidencePreferences ? (
                  <p id="case-preference-error" className="mt-2 text-xs text-signal-bright">
                    {errors.evidencePreferences}
                  </p>
                ) : null}
              </fieldset>

              <FictionNotice>{FICTION_NOTICE}</FictionNotice>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.68rem] leading-relaxed text-paper/35">
                  The form stays locked while the case is prepared.
                  <br />
                  Duplicate submissions are blocked.
                </p>
                <Button
                  type="submit"
                  loading={pending}
                  loadingLabel="Submitting the brief…"
                  disabled={formLocked}
                  icon={<SparkIcon className="size-4" />}
                  className="sm:min-w-48"
                >
                  {formLocked ? "Preparing the case…" : "Create the case"}
                </Button>
              </div>
            </div>
          </Panel>
        </form>

        {generation ? (
          <GenerationProgressPanel
            generation={generation}
            pollError={pollError}
            onRetryPoll={retryPoll}
            onRetryGeneration={retryGeneration}
            onChangeBrief={changeBrief}
            onPlaySample={sample.start}
            samplePending={sample.pending}
            sampleError={sample.error}
            retryPending={pending}
          />
        ) : null}

        {submissionError ? (
          <ErrorPanel
            className="mt-5"
            title="The case could not be submitted"
            error={submissionError}
            onRetry={() => {
              const form = document.querySelector<HTMLFormElement>(
                'form[aria-label="Create a mystery"]',
              );
              form?.requestSubmit();
            }}
            retryLabel="Submit the brief again"
          />
        ) : null}
      </div>

      <aside className="space-y-4">
        <Panel className="p-5">
          <Kicker>Ready now</Kicker>
          <h2 className="mt-2 font-display text-xl text-paper">The Meridian at Midnight</h2>
          <p className="mt-2 text-xs leading-relaxed text-paper/55">
            A complete sample investigation with four suspects, eight exhibits, three
            hints, and a server-scored reveal. No provider key required.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={sample.start}
            loading={sample.pending}
            loadingLabel="Preparing the file…"
            icon={<FileIcon className="size-4" />}
          >
            Play the sample
          </Button>
          {sample.error ? (
            <p role="alert" className="mt-3 text-xs leading-relaxed text-signal-bright">
              {sample.error instanceof ApiError
                ? sample.error.message
                : "The sample could not be prepared."}
            </p>
          ) : null}
        </Panel>

        <Panel className="p-5">
          <Kicker>What happens next</Kicker>
          <ol className="mt-3 space-y-3">
            {[
              "Your brief is validated before a case is accepted.",
              "One culprit is fixed before suspects, timeline, and clues are written.",
              "The canonical solution and every reference are checked before publication.",
              "The investigation room opens only after the validated file is saved.",
            ].map((step, index) => (
              <li key={step} className="flex gap-3 text-xs leading-relaxed text-paper/55">
                <span className="font-mono text-[0.6rem] text-brass/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-white/10 pt-3 text-[0.68rem] leading-relaxed text-paper/35">
            Generation runs inside the API process. If that process restarts mid-case,
            the attempt fails safely and can be retried. The sample is unaffected.
          </p>
        </Panel>

        <div className="border border-white/10 px-4 py-3.5">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-brass/70">
            Progress note
          </p>
          <p className="mt-2 text-xs leading-relaxed text-paper/45">
            A guest session is stored in this browser using an HttpOnly cookie. Clearing
            cookies can lose access to an in-progress case.
          </p>
        </div>

        <div className="flex items-start gap-2.5 border border-brass/20 bg-brass/[0.035] px-4 py-3.5">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-brass/75" />
          <p className="text-[0.68rem] leading-relaxed text-paper/45">
            Generated cases and any static diagrams are fictional. No exhibit is a real
            message, photograph, or surveillance record.
          </p>
        </div>

        <a
          href="#main"
          className="inline-flex items-center gap-1.5 text-xs text-paper/40 hover:text-paper/70"
        >
          Back to top
          <ArrowRightIcon className="size-3 -rotate-90" />
        </a>
      </aside>
    </div>
  );
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}
