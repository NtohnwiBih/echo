import { describe, it, expect } from "vitest";
import { pickFacts, type RetrievedFact } from "./retrieve";

function fact(text: string, score: number): RetrievedFact {
  return {
    hash: text,
    text,
    docId: "world-test",
    owner: null,
    audience: ["mira"],
    reliability: "confirmed",
    source: null,
    score,
  };
}

const options = { limit: 3, minScore: 0.5 };

describe("pickFacts", () => {
  it("drops facts below the cut-off", () => {
    const kept = pickFacts([fact("close", 0.7), fact("far", 0.3)], options);
    expect(kept.map((f) => f.text)).toEqual(["close"]);
  });

  it("keeps a fact that scores exactly the cut-off", () => {
    expect(pickFacts([fact("edge", 0.5)], options)).toHaveLength(1);
  });

  it("puts the best fact first", () => {
    const kept = pickFacts([fact("b", 0.6), fact("a", 0.9), fact("c", 0.7)], options);
    expect(kept.map((f) => f.text)).toEqual(["a", "c", "b"]);
  });

  it("keeps at most the limit", () => {
    const many = [0.9, 0.8, 0.7, 0.6, 0.55].map((s) => fact(`f${s}`, s));
    expect(pickFacts(many, options)).toHaveLength(3);
  });

  it("returns nothing when nothing is close enough", () => {
    expect(pickFacts([fact("far", 0.2)], options)).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const input = [fact("b", 0.6), fact("a", 0.9)];
    pickFacts(input, options);
    expect(input.map((f) => f.text)).toEqual(["b", "a"]);
  });

  it("keeps at most maxPerDoc facts from one document", () => {
    const same = [0.9, 0.8, 0.7].map((s) => ({ ...fact(`f${s}`, s), docId: "doc-a" }));
    const other = { ...fact("other", 0.6), docId: "doc-b" };
    const kept = pickFacts([...same, other], { limit: 5, minScore: 0.5, maxPerDoc: 2 });
    expect(kept.map((f) => f.text)).toEqual(["f0.9", "f0.8", "other"]);
  });
});
