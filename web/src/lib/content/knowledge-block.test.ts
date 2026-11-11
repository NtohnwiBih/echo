import { describe, it, expect } from "vitest";
import { buildKnowledgeBlock, FALLBACK_LINE, NO_INFORMATION_BLOCK } from "./knowledge-block";
import type { RetrievedFact } from "./retrieve";

function fact(text: string, reliability: RetrievedFact["reliability"]): RetrievedFact {
  return {
    hash: text,
    text,
    docId: "world-test",
    owner: null,
    audience: ["mira"],
    reliability,
    source: null,
    score: 0.9,
  };
}

describe("buildKnowledgeBlock", () => {
  it("says plainly that the character knows nothing when there are no facts", () => {
    const block = buildKnowledgeBlock([]);
    expect(block).toBe(NO_INFORMATION_BLOCK);
    expect(block).toContain("no information");
  });

  it("starts with the heading the shared rules refer to", () => {
    const block = buildKnowledgeBlock([fact("The Council has seven members.", "confirmed")]);
    expect(block.startsWith("What you know about this question:")).toBe(true);
  });

  it("lists each fact as a bullet, with no label when confirmed", () => {
    const block = buildKnowledgeBlock([fact("The Council has seven members.", "confirmed")]);
    expect(block).toContain("- The Council has seven members.");
  });

  it("labels reported facts and rumours", () => {
    const block = buildKnowledgeBlock([
      fact("The blackouts follow a pattern.", "rumour"),
      fact("A drone stayed powered.", "reported"),
    ]);
    expect(block).toContain("- (rumour, not confirmed) The blackouts follow a pattern.");
    expect(block).toContain("- (reported, not confirmed) A drone stayed powered.");
  });

  it("tells the character what to do when the facts do not answer the question", () => {
    const block = buildKnowledgeBlock([fact("A fact.", "confirmed")]);
    expect(block.endsWith(FALLBACK_LINE)).toBe(true);
  });
});
