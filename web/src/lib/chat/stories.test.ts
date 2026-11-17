import { describe, it, expect } from "vitest";
import { characters } from "../characters";
import { getStory } from "./stories";

describe("getStory", () => {
  it("has page content for every character", () => {
    for (const c of characters) expect(getStory(c.slug)).toBeDefined();
  });

  it("gives every character an opening and three suggestions", () => {
    for (const c of characters) {
      const story = getStory(c.slug);
      expect(story?.opening.trim()).not.toBe("");
      expect(story?.suggestions).toHaveLength(3);
    }
  });

  it("returns nothing for an unknown character", () => {
    expect(getStory("nobody")).toBeUndefined();
  });

  it("does not treat built-in object keys as characters", () => {
    expect(getStory("constructor")).toBeUndefined();
  });
});
