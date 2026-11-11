import { describe, it, expect } from "vitest";
import { buildCharacterSystemPrompt, characters, renderCharacterPrompt } from "./characters";
import { FALLBACK_LINE, NO_INFORMATION_BLOCK } from "./content/knowledge-block";
import type { RetrievedFact } from "./content/retrieve";
import { RAG_PREAMBLE, buildMessages, buildStableSystemPrompt } from "./prompt";

const mira = characters[0];

function fact(text: string): RetrievedFact {
  return {
    hash: text,
    text,
    docId: "world-test",
    owner: null,
    audience: ["mira"],
    reliability: "confirmed",
    source: null,
    score: 0.9,
  };
}

describe("buildStableSystemPrompt", () => {
  it("starts with the shared rules", () => {
    expect(buildStableSystemPrompt(mira).startsWith(RAG_PREAMBLE)).toBe(true);
  });

  it("leaves out the per-character knows list", () => {
    expect(buildStableSystemPrompt(mira)).not.toContain("What you know:");
    expect(renderCharacterPrompt(mira, { includeKnows: false })).not.toContain(mira.knows[0]);
  });

  it("is shorter than the old prompt that carried the world file", () => {
    expect(buildStableSystemPrompt(mira).length).toBeLessThan(
      buildCharacterSystemPrompt(mira).length,
    );
  });

  it("names the section that holds the retrieved facts", () => {
    expect(RAG_PREAMBLE).toContain("What you know about this question");
  });
});

describe("buildMessages", () => {
  it("puts the stable prompt first, and it does not change with the facts", () => {
    const a = buildMessages({ character: mira, facts: [fact("One.")], userMessage: "Hi" });
    const b = buildMessages({ character: mira, facts: [fact("Two.")], userMessage: "Hi" });
    expect(a[0]).toEqual({ role: "system", content: buildStableSystemPrompt(mira) });
    expect(a[0]).toEqual(b[0]);
  });

  it("ends with the facts and then the player's words", () => {
    const messages = buildMessages({
      character: mira,
      facts: [fact("The Council has seven members.")],
      userMessage: "Who leads the Council?",
    });
    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain("- The Council has seven members.");
    expect(last.content.endsWith("The player says: Who leads the Council?")).toBe(true);
  });

  it("uses the no-information block when there are no facts", () => {
    const messages = buildMessages({ character: mira, facts: [], userMessage: "Hi" });
    expect(messages[messages.length - 1].content).toContain(NO_INFORMATION_BLOCK);
  });

  it("tells the character what to do when the facts do not answer", () => {
    const messages = buildMessages({ character: mira, facts: [fact("A.")], userMessage: "Hi" });
    expect(messages[messages.length - 1].content).toContain(FALLBACK_LINE);
  });

  it("keeps the history between the system prompt and the new message", () => {
    const history = [
      { role: "user" as const, content: "Earlier question" },
      { role: "assistant" as const, content: "Earlier answer" },
    ];
    const messages = buildMessages({ character: mira, facts: [], history, userMessage: "Now" });
    expect(messages).toHaveLength(4);
    expect(messages[1]).toEqual(history[0]);
    expect(messages[2]).toEqual(history[1]);
  });
});
