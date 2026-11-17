"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { parseSegments } from "@/lib/chat/segments";
import { useChat } from "./use-chat";

type Props = {
  slug: string;
  name: string;
  subtitle: string;
  opening: string;
  suggestions: string[];
};

/** Shows spoken text normally and *actions* in grey italics. */
function Segments({ text }: { text: string }) {
  return (
    <>
      {parseSegments(text).map((segment, index) => (
        <Fragment key={index}>
          {segment.kind === "action" ? (
            <em className="text-muted">{segment.text}</em>
          ) : (
            <span>{segment.text}</span>
          )}{" "}
        </Fragment>
      ))}
    </>
  );
}

export function ChatView({ slug, name, subtitle, opening, suggestions }: Props) {
  const { state, send, stop } = useChat({ character: slug, opening });
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = state.status !== "idle";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: state.status === "streaming" ? "auto" : "smooth",
      block: "end",
    });
  }, [state.messages, state.status]);

  function submit(text: string) {
    if (busy || !text.trim()) return;
    setDraft("");
    void send(text);
  }

  const last = state.messages[state.messages.length - 1];
  const waitingForFirstWord =
    state.status === "streaming" && last?.role === "assistant" && last.text === "";

  let statusText = "";
  if (state.status === "queued" && state.ahead > 0) {
    statusText = `${name} is talking with someone else. You are number ${state.ahead + 1} in line.`;
  } else if (state.status === "queued" || waitingForFirstWord) {
    statusText = `${name} is thinking…`;
  }

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      <header className="border-line flex items-center gap-3 border-b py-4">
        <Link href="/" aria-label="Back" className="text-muted hover:text-text">
          ←
        </Link>
        <div
          aria-hidden
          className="border-accent/40 bg-surface font-display text-accent flex size-10 items-center justify-center rounded-full border text-lg"
        >
          {name[0]}
        </div>
        <div>
          <h1 className="font-display text-xl leading-tight">{name}</h1>
          <p className="text-muted text-xs">{subtitle}</p>
        </div>
      </header>

      <div role="log" aria-busy={busy} className="flex-1 space-y-6 overflow-y-auto py-6">
        {state.messages.map((message) =>
          message.role === "assistant" ? (
            <p key={message.id} className="font-display max-w-[40rem] text-xl leading-relaxed">
              <Segments text={message.text} />
            </p>
          ) : (
            <p
              key={message.id}
              className="bg-surface ml-auto w-fit max-w-[80%] rounded-2xl px-4 py-2 text-sm"
            >
              <Segments text={message.text} />
            </p>
          ),
        )}
        {statusText && (
          <p aria-live="polite" className="text-muted text-sm italic">
            {statusText}
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="pb-4">
        {!busy && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submit(suggestion)}
                className="border-line text-muted hover:border-accent/60 hover:text-text rounded-full border px-3 py-1.5 text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
          className="border-line bg-surface flex items-center gap-2 rounded-2xl border p-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            placeholder="Speak, or *describe an action*…"
            aria-label={`Message to ${name}`}
            className="placeholder:text-muted min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="border-line hover:border-accent/60 rounded-xl border px-4 py-2 text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="bg-accent text-accent-ink rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Send
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
