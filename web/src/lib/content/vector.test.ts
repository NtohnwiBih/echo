import { describe, it, expect } from "vitest";
import { toVectorLiteral } from "./vector";

describe("toVectorLiteral", () => {
  it("formats numbers the way pgvector expects", () => {
    expect(toVectorLiteral([0.5, -1, 2], 3)).toBe("[0.5,-1,2]");
  });

  it("rejects a vector of the wrong length", () => {
    expect(() => toVectorLiteral([1, 2], 3)).toThrow("expected a vector with 3");
  });

  it("rejects values that are not finite numbers", () => {
    expect(() => toVectorLiteral([1, Number.NaN, 3], 3)).toThrow("finite");
  });
});
