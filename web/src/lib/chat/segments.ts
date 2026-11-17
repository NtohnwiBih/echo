export type Segment = { kind: "speech" | "action"; text: string };

// An action is text between two single asterisks, on one line.
const ACTION = /\*([^*\n]+)\*/g;

/** Splits a message into spoken text and *action* text, in order. */
export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const addSpeech = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) segments.push({ kind: "speech", text: trimmed });
  };

  let cursor = 0;
  for (const match of text.matchAll(ACTION)) {
    const start = match.index ?? 0;
    addSpeech(text.slice(cursor, start));
    const action = match[1].trim();
    if (action) segments.push({ kind: "action", text: action });
    cursor = start + match[0].length;
  }
  addSpeech(text.slice(cursor));
  return segments;
}
