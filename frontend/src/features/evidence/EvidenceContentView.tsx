import { useEffect, useState } from "react";
import type { EvidenceContent } from "@amr/shared";
import { ImageIcon } from "../../components/Icons";

export function EvidenceContentView({
  content,
  altText,
}: {
  content: EvidenceContent;
  altText?: string;
}) {
  switch (content.format) {
    case "chat":
      return (
        <section aria-label={`Chat transcript from ${content.channel}`}>
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
            <h4 className="font-display text-lg text-paper">{content.channel}</h4>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-paper/40">
              {content.participants.join(" · ")}
            </p>
          </header>
          <ol className="mt-4 space-y-3">
            {content.messages.map((message, index) => (
              <li
                key={`${message.at}-${message.sender}-${index}`}
                className={message.system ? "text-center" : undefined}
              >
                {message.system ? (
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-paper/35">
                    {message.text}
                  </p>
                ) : (
                  <div className="chat-bubble px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-paper">{message.sender}</p>
                      <p className="font-mono text-[0.64rem] text-paper/40">{message.at}</p>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-paper/75">
                      {message.text}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      );

    case "log":
      return (
        <section aria-label="Recorded log">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Simulated log entries with time, actor, action, location, and note
              </caption>
              <thead>
                <tr className="border-b border-white/15">
                  {["Time", "Actor", "Event", "Location", "Note"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-2 py-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-brass/75"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.entries.map((entry, index) => (
                  <tr
                    key={`${entry.at}-${entry.action}-${index}`}
                    className="border-b border-white/[0.06] align-top last:border-0"
                  >
                    <td className="whitespace-nowrap px-2 py-3 font-mono text-xs text-paper/55">
                      {entry.at}
                    </td>
                    <td className="px-2 py-3 text-paper/80">{entry.actor ?? "—"}</td>
                    <td className="px-2 py-3 text-paper">{entry.action}</td>
                    <td className="px-2 py-3 text-paper/65">{entry.location ?? "—"}</td>
                    <td className="px-2 py-3 text-xs text-paper/45">{entry.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );

    case "statement":
      return (
        <section aria-label={`Statement from ${content.speaker}`}>
          <figure>
            <blockquote className="quote-mark border-l-2 border-brass/50 pl-5 font-display text-lg leading-relaxed text-paper/90">
              “{content.statement}”
            </blockquote>
            <figcaption className="mt-4 border-t border-white/10 pt-3">
              <p className="text-sm font-semibold text-paper">{content.speaker}</p>
              {content.recordedAt ? (
                <p className="mt-0.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-paper/40">
                  Recorded {content.recordedAt}
                </p>
              ) : null}
              {content.context ? (
                <p className="mt-2 text-xs leading-relaxed text-paper/50">{content.context}</p>
              ) : null}
            </figcaption>
          </figure>
        </section>
      );

    case "document":
      return (
        <section aria-label={content.heading ?? "Document exhibit"} className="paper-lines px-1">
          {content.heading ? (
            <h4 className="font-display text-xl text-paper">{content.heading}</h4>
          ) : null}
          <div className="mt-4 space-y-5">
            {content.sections.map((section, sectionIndex) => (
              <section key={`${section.heading ?? "section"}-${sectionIndex}`}>
                {section.heading ? (
                  <h5 className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-brass/80">
                    {section.heading}
                  </h5>
                ) : null}
                <div className="mt-2 space-y-2">
                  {section.body.map((paragraph, paragraphIndex) => (
                    <p
                      key={`${sectionIndex}-${paragraphIndex}`}
                      className="text-sm leading-relaxed text-paper/75"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {content.annotations && content.annotations.length > 0 ? (
            <div className="mt-5 border-t border-white/10 pt-3">
              <h5 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-paper/40">
                Registrar annotations
              </h5>
              <ul className="mt-2 space-y-1.5">
                {content.annotations.map((annotation) => (
                  <li key={annotation} className="text-xs leading-relaxed text-paper/55">
                    — {annotation}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      );

    case "image":
      return <EvidenceImage content={content} altText={altText} />;

    case "transcript":
      return (
        <section aria-label={`Transcript from ${content.source}`}>
          <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brass/80">
            {content.source}
          </h4>
          <ol className="mt-3 space-y-2.5">
            {content.lines.map((line, index) => (
              <li
                key={`${line.at ?? "line"}-${line.speaker}-${index}`}
                className="grid gap-1 border-b border-white/[0.06] pb-2.5 last:border-0 sm:grid-cols-[4.5rem_10rem_minmax(0,1fr)] sm:gap-3"
              >
                <span className="font-mono text-[0.66rem] text-paper/35">{line.at ?? ""}</span>
                <span className="text-xs font-semibold text-brass/85">{line.speaker}</span>
                <span className="text-sm leading-relaxed text-paper/75">{line.text}</span>
              </li>
            ))}
          </ol>
        </section>
      );

    case "generic":
      return (
        <section aria-label="Exhibit text" className="space-y-3">
          {content.body.map((paragraph, index) => (
            <p key={index} className="text-sm leading-relaxed text-paper/75">
              {paragraph}
            </p>
          ))}
        </section>
      );
  }
}

function EvidenceImage({
  content,
  altText,
}: {
  content: Extract<EvidenceContent, { format: "image" }>;
  altText?: string;
}) {
  const [failed, setFailed] = useState(!content.imageUrl);

  useEffect(() => {
    setFailed(!content.imageUrl);
  }, [content.imageUrl]);

  return (
    <figure>
      <div className="border border-white/10 bg-ink/60 p-2">
        {failed ? (
          <div
            role="status"
            className="flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed border-white/15 px-6 py-10 text-center"
          >
            <span className="grid size-12 place-items-center border border-brass/30 bg-brass/5 text-brass/70">
              <ImageIcon className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-lg text-paper">Exhibit image unavailable</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-paper/50">
                The static diagram could not be loaded. The written description and
                interpretation below remain part of the exhibit.
              </p>
            </div>
          </div>
        ) : (
          <img
            src={content.imageUrl}
            alt={altText ?? content.caption}
            className="mx-auto block h-auto w-full"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <figcaption className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-paper/80">{content.caption}</p>
          {content.simulated ? (
            <span className="border border-brass/40 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-brass/80">
              Simulated asset
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-paper/50">
          <span className="font-semibold text-paper/65">What it shows: </span>
          {content.interpretation}
        </p>
      </figcaption>
    </figure>
  );
}
