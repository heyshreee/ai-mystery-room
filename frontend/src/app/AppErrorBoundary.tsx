import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/Button";
import { AlertIcon } from "../components/Icons";

interface ErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled application error", error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
          <span className="grid size-12 place-items-center border border-signal/40 bg-signal/10 text-signal-bright">
            <AlertIcon className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-3xl text-paper">The room hit an error.</h1>
          <p className="mt-2 text-sm leading-relaxed text-paper/55">
            The interface could not render this view. Reloading may recover the case file.
            No solution data is stored in the browser.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={() => window.location.reload()}>
              Reload the room
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.assign("/");
              }}
            >
              Return home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
