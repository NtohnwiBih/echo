import { describe, it, expect } from "vitest";
import type { ChatEvent } from "./events";
import { chatReducer, initialState, type ChatState } from "./state";

const run = (state: ChatState, ...events: ChatEvent[]) =>
  events.reduce((current, event) => chatReducer(current, { type: "event", event }), state);

const sent = (state: ChatState, text = "Hello") =>
  chatReducer(state, { type: "sent", id: "u1", text });

const start: ChatEvent = { type: "start", conversationId: "c1", messageId: "m1" };

describe("chatReducer", () => {
  it("starts with the opening line and nothing running", () => {
    const state = initialState("Welcome.");
    expect(state.messages).toEqual([{ id: "opening", role: "assistant", text: "Welcome." }]);
    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
  });

  it("adds the player's message and waits in the queue", () => {
    const state = sent(initialState("Welcome."));
    expect(state.messages.map((m) => m.role)).toEqual(["assistant", "user"]);
    expect(state.status).toBe("queued");
  });

  it("clears an earlier error when a new message is sent", () => {
    const failed = chatReducer(initialState(), { type: "failed", message: "boom" });
    expect(sent(failed).error).toBeNull();
  });

  it("remembers how many requests are ahead", () => {
    const state = run(sent(initialState()), { type: "queued", ahead: 2 });
    expect(state.ahead).toBe(2);
  });

  it("adds an empty reply and keeps the conversation id when the reply starts", () => {
    const state = run(sent(initialState()), { type: "queued", ahead: 1 }, start);
    expect(state.status).toBe("streaming");
    expect(state.conversationId).toBe("c1");
    expect(state.ahead).toBe(0);
    expect(state.messages[state.messages.length - 1]).toEqual({
      id: "m1",
      role: "assistant",
      text: "",
    });
  });

  it("appends each piece to the newest reply only", () => {
    const state = run(
      sent(initialState("Welcome.")),
      start,
      { type: "delta", text: "The Council" },
      { type: "delta", text: " has no leader." },
    );
    expect(state.messages[0].text).toBe("Welcome.");
    expect(state.messages[state.messages.length - 1].text).toBe("The Council has no leader.");
  });

  it("returns to idle when the reply is done", () => {
    const state = run(
      sent(initialState()),
      start,
      { type: "delta", text: "Hi." },
      { type: "done" },
    );
    expect(state.status).toBe("idle");
  });

  it("drops an empty reply and shows the error when the server reports one", () => {
    const state = run(sent(initialState()), start, { type: "error", message: "No answer." });
    expect(state.error).toBe("No answer.");
    expect(state.messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("keeps a partial reply when an error arrives mid-way", () => {
    const state = run(
      sent(initialState()),
      start,
      { type: "delta", text: "Partial" },
      { type: "error", message: "Stopped." },
    );
    expect(state.messages[state.messages.length - 1].text).toBe("Partial");
  });

  it("records a network failure", () => {
    const state = chatReducer(sent(initialState()), { type: "failed", message: "offline" });
    expect(state.status).toBe("idle");
    expect(state.error).toBe("offline");
  });

  it("keeps the text when the player stops a reply", () => {
    const streaming = run(sent(initialState()), start, { type: "delta", text: "Half a reply" });
    const state = chatReducer(streaming, { type: "closed" });
    expect(state.status).toBe("idle");
    expect(state.messages[state.messages.length - 1].text).toBe("Half a reply");
  });

  it("never changes the state it was given", () => {
    const before = sent(initialState("Welcome."));
    const snapshot = JSON.stringify(before);
    run(before, start, { type: "delta", text: "x" });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
