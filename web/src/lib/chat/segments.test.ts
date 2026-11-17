import { describe, it, expect } from "vitest";
import { parseSegments } from "./segments";

describe("parseSegments", () => {
  it("returns nothing for empty text", () => {
    expect(parseSegments("")).toEqual([]);
  });

  it("treats plain text as speech", () => {
    expect(parseSegments("Hello there.")).toEqual([{ kind: "speech", text: "Hello there." }]);
  });

  it("separates an action from the speech after it", () => {
    expect(parseSegments("*Mira nods.* Come in.")).toEqual([
      { kind: "action", text: "Mira nods." },
      { kind: "speech", text: "Come in." },
    ]);
  });

  it("keeps the order of speech, action, speech", () => {
    expect(parseSegments("Hello. *She smiles.* Sit down.").map((s) => s.kind)).toEqual([
      "speech",
      "action",
      "speech",
    ]);
  });

  it("handles two actions in a row", () => {
    expect(parseSegments("*a* *b*")).toEqual([
      { kind: "action", text: "a" },
      { kind: "action", text: "b" },
    ]);
  });

  it("leaves a lone asterisk in the speech", () => {
    expect(parseSegments("Wait * what")).toEqual([{ kind: "speech", text: "Wait * what" }]);
  });
});
