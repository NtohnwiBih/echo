export type ChatEvent =
  | { type: "queued"; ahead: number }
  | { type: "start"; conversationId: string; messageId: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const EVENT_TYPES = new Set(["queued", "start", "delta", "done", "error"]);
const encoder = new TextEncoder();

/** One event as one line of JSON, ready to write to the response. */
export function encodeEvent(event: ChatEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

/** True when a parsed value has the shape of a chat event. */
export function isChatEvent(value: unknown): value is ChatEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    EVENT_TYPES.has(String(value.type))
  );
}

/** Reads one line back into an event, or null if it is blank or not an event. */
export function parseEventLine(line: string): ChatEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    return isChatEvent(value) ? value : null;
  } catch {
    return null; // not JSON: treat it as noise
  }
}
