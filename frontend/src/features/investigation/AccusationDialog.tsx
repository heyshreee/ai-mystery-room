import { useEffect, useRef } from "react";
import type { SuspectView } from "@amr/shared";
import { ApiError } from "../../lib/api";
import { initials } from "../../lib/format";
import { Button } from "../../components/Button";
import { AlertIcon, CloseIcon, ScaleIcon } from "../../components/Icons";

export function AccusationDialog({
  open,
  suspects,
  selectedSuspectId,
  onSelectSuspect,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  suspects: SuspectView[];
  selectedSuspectId: string | null;
  onSelectSuspect: (suspectId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: unknown;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      const firstInput = dialog.querySelector<HTMLInputElement>(
        'input[name="accused-suspect"]',
      );
      firstInput?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const errorMessage =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The accusation could not be submitted.";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="accusation-title"
      aria-describedby="accusation-warning"
      className="m-auto w-[min(94vw,34rem)] max-h-[90vh] overflow-y-auto rounded-sm border border-brass/35 bg-panel p-0 text-paper shadow-[0_40px_120px_rgba(0,0,0,0.7)] scrollbar-thin"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center border border-signal/40 bg-signal/10 text-signal-bright">
            <ScaleIcon className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-signal-bright">
              Final action
            </p>
            <h2 id="accusation-title" className="mt-1 font-display text-2xl text-paper">
              Name the culprit
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="grid size-9 shrink-0 place-items-center border border-white/10 text-paper/55 hover:border-white/25 hover:text-paper disabled:cursor-not-allowed disabled:text-paper/25"
          aria-label="Close accusation dialog"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="px-5 py-4">
        <p
          id="accusation-warning"
          className="border border-signal/30 bg-signal/[0.06] px-3 py-2.5 text-xs leading-relaxed text-paper/70"
        >
          This is your one final accusation. The case will close immediately, the solution
          will be revealed, and the choice cannot be changed.
        </p>

        <fieldset className="mt-4">
          <legend className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-brass/80">
            Select exactly one suspect
          </legend>
          <div className="mt-2 grid gap-1.5">
            {suspects.map((suspect) => (
              <label key={suspect.id} htmlFor={`accused-${suspect.id}`} className="choice items-center">
                <input
                  id={`accused-${suspect.id}`}
                  type="radio"
                  name="accused-suspect"
                  value={suspect.id}
                  checked={selectedSuspectId === suspect.id}
                  onChange={() => onSelectSuspect(suspect.id)}
                  disabled={pending}
                />
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-[0.6rem] text-paper/55"
                  >
                    {initials(suspect.displayName)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-paper">
                      {suspect.displayName}
                    </span>
                    <span className="block truncate text-[0.68rem] text-paper/60">
                      {suspect.role}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <div
            role="alert"
            className="mt-4 flex gap-2 border border-signal/35 bg-signal/[0.07] px-3 py-2.5"
          >
            <AlertIcon className="mt-0.5 size-4 shrink-0 text-signal-bright" />
            <p className="text-xs leading-relaxed text-paper/75">{errorMessage}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-white/10 bg-ink/35 px-5 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Back to the file
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          loading={pending}
          loadingLabel="Closing the case…"
          disabled={!selectedSuspectId}
          icon={<ScaleIcon className="size-4" />}
        >
          Submit final accusation
        </Button>
      </div>
    </dialog>
  );
}
