import { Link } from "react-router-dom";
import { ArrowLeftIcon, SearchIcon } from "../components/Icons";
import { buttonClasses } from "../components/button-classes";
import { Kicker } from "../components/Panel";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-4 py-20 sm:px-6 sm:py-28">
      <span className="grid size-12 place-items-center border border-brass/35 bg-brass/5 text-brass-bright">
        <SearchIcon className="size-6" />
      </span>
      <Kicker className="mt-5">No file at this address</Kicker>
      <h1 className="mt-2 font-display text-4xl text-paper sm:text-5xl">
        This room is empty.
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/55">
        The page or case you asked for is not here. It may have expired, been removed, or
        never existed. The sample investigation is always available.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link to="/sample" className={buttonClasses("primary")}>
          Play the sample case
        </Link>
        <Link to="/" className={buttonClasses("secondary")}>
          <ArrowLeftIcon className="size-4" />
          Return home
        </Link>
      </div>
    </div>
  );
}
