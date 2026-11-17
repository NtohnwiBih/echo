import { describe, it, expect } from "vitest";
import { encodeEvent, isChatEvent, parseEventLine } from "./events";

describe("chat events", () => {
  it("writes one JSON object per line", () => {
    const text = new TextDecoder().decode(encodeEvent({ type: "delta", text: "hi" }));
    expect(text).toBe('{"type":"delta","text":"hi"}\n');
  });

  it("reads a line back into an event", () => {
    expect(parseEventLine('{"type":"queued","ahead":2}')).toEqual({
      type: "queued",
      ahead: 2,
    });
  });

  it("ignores blank lines, junk and unknown event types", () => {
    expect(parseEventLine("")).toBeNull();
    expect(parseEventLine("not json")).toBeNull();
    expect(parseEventLine('{"type":"mystery"}')).toBeNull();
  });

  it("recognises a chat event", () => {
    expect(isChatEvent({ type: "done" })).toBe(true);
  });

  it("rejects values that are not chat events", () => {
    expect(isChatEvent(null)).toBe(false);
    expect(isChatEvent("done")).toBe(false);
    expect(isChatEvent({ type: "mystery" })).toBe(false);
  });
});
