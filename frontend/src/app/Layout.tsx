import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FICTION_NOTICE } from "@amr/shared";
import { cn } from "../lib/format";
import { ArrowRightIcon } from "../components/Icons";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function Brand() {
  return (
    <Link
      to="/"
      className="group flex items-center gap-3 rounded-sm py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
    >
      <span aria-hidden="true" className="relative grid size-9 place-items-center border border-brass/50 bg-brass/10">
        <span className="font-display text-lg leading-none text-brass-bright">M</span>
        <span className="absolute -right-1 -top-1 size-2 border border-brass/60 bg-ink" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[1.05rem] tracking-[0.02em] text-paper transition-colors group-hover:text-brass-bright">
          AI Mystery Room
        </span>
        <span className="hidden font-mono text-[0.58rem] uppercase tracking-[0.2em] text-paper/40 sm:block">
          Fictional case files
        </span>
      </span>
    </Link>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <a
        href="#main"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-sm border border-brass bg-ink px-4 py-2 text-sm text-paper focus:translate-y-0"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand />
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/create"
              className={({ isActive }) =>
                cn(
                  "rounded-sm px-2.5 py-2 text-sm transition-colors sm:px-3",
                  isActive
                    ? "bg-brass/10 text-brass-bright"
                    : "text-paper/60 hover:bg-white/5 hover:text-paper",
                )
              }
            >
              Create a mystery
            </NavLink>
            <NavLink
              to="/sample"
              className="inline-flex items-center gap-1.5 rounded-sm border border-brass/45 bg-brass/10 px-3 py-2 text-sm font-medium text-brass-bright transition-colors hover:bg-brass/20"
            >
              <span>Play sample</span>
              <ArrowRightIcon className="size-3.5" />
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-white/10 bg-ink/50">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-brass/70">
              Notice of fiction
            </p>
            <p className="mt-2 text-xs leading-relaxed text-paper/45">{FICTION_NOTICE}</p>
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-paper/35">
              Phase 2 · deterministic sample
            </p>
            <p className="mt-1 text-xs text-paper/35">
              Live AI generation is not connected in this build.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
