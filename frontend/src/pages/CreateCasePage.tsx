import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import { Kicker } from "../components/Panel";
import { CreateCaseForm } from "../features/case-creation/CreateCaseForm";

export function CreateCasePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-paper/45 hover:text-paper/75"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to the room
      </Link>
      <div className="mt-6 max-w-3xl">
        <Kicker>New case file</Kicker>
        <h1 className="mt-3 font-display text-4xl leading-tight text-paper sm:text-5xl">
          Create a Mystery
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper/55 sm:text-base">
          Give the room a situation worth investigating. The brief becomes a fictional
          case file with suspects, a timeline, exhibits, and a single answer the evidence
          can support.
        </p>
      </div>
      <div className="mt-8">
        <CreateCaseForm />
      </div>
    </div>
  );
}
