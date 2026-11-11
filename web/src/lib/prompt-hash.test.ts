import { describe, it, expect } from "vitest";
import { promptHash } from "./prompt-hash";

describe("promptHash", () => {
  it("is stable for the same text", () => {
    expect(promptHash("abc")).toBe(promptHash("abc"));
  });
  it("changes when the text changes", () => {
    expect(promptHash("abc")).not.toBe(promptHash("abd"));
  });
  it("is 8 hex characters", () => {
    expect(promptHash("abc")).toMatch(/^[0-9a-f]{8}$/);
  });
});
