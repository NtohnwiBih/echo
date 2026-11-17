import { readNdjson } from "../gateway/ndjson";
import { isChatEvent, type ChatEvent } from "./events";

type SendArgs = {
  character: string;
  message: string;
  conversationId?: string;
  signal?: AbortSignal;
};

/** Sends one message and yields the server's events as they arrive. */
export async function* streamChat({
  character,
  message,
  conversationId,
  signal,
}: SendArgs): AsyncGenerator<ChatEvent> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character, message, conversationId }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(detail?.error ?? `request failed (${response.status})`);
  }

  for await (const raw of readNdjson(response.body)) {
    if (isChatEvent(raw)) yield raw;
  }
}
