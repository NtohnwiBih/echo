import { describe, it, expect } from "vitest";
import type { ChatMessage } from "../gateway/types";
import { retrievalQuery } from "./retrieval-query";

const history: ChatMessage[] = [
  { role: "user", content: "Tell me about Vorr" },
  { role: "assistant", content: "*nods* Vorr led the Meridian Grid project." },
];

describe("retrievalQuery", () => {
  it("leaves a full message alone", () => {
    expect(retrievalQuery("Who leads the Council right now?", history)).toBe(
      "Who leads the Council right now?",
    );
  });

  it("leaves a short message alone when there is no history", () => {
    expect(retrievalQuery("what", [])).toBe("what");
  });

  it("adds the last reply, without its actions, to a short message", () => {
    const query = retrievalQuery("what", history);
    expect(query).toContain("Vorr led the Meridian Grid project.");
    expect(query).not.toContain("nods");
    expect(query.endsWith("what")).toBe(true);
  });
});
