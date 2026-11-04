import { describe, it, expect } from "vitest";
import {
  CHARACTER_PREAMBLE,
  buildCharacterSystemPrompt,
  characters,
  getCharacterBySlug,
  renderCharacterPrompt,
} from "./characters";

// Rough estimate: 1 token is about 4 characters of English.
// Replace with the real token count from the model once the gateway exists.
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

describe("characters", () => {
  it("has unique slugs", () => {
    const slugs = characters.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has a positive integer version", () => {
    for (const c of characters) {
      expect(Number.isInteger(c.version)).toBe(true);
      expect(c.version).toBeGreaterThan(0);
    }
  });

  it("has no empty fields", () => {
    for (const c of characters) {
      expect(c.name.trim()).not.toBe("");
      expect(c.role.trim()).not.toBe("");
      expect(c.background.trim()).not.toBe("");
      expect(c.voice.tone.trim()).not.toBe("");
      for (const list of [
        c.personality,
        c.wants,
        c.fears,
        c.flaws,
        c.voice.patterns,
      ]) {
        expect(list.length).toBeGreaterThan(0);
        for (const item of list) expect(item.trim()).not.toBe("");
      }
    }
  });

  it("is written in second person", () => {
    for (const c of characters) {
      expect(renderCharacterPrompt(c)).not.toMatch(/\b(he|she|his|her|him)\b/i);
    }
  });

  it("keeps the full system prompt within the token budget", () => {
    for (const c of characters) {
      expect(estimateTokens(buildCharacterSystemPrompt(c))).toBeLessThan(400);
    }
  });

  it("starts every system prompt with the shared preamble", () => {
    // A stable prefix lets Ollama reuse its cache between turns.
    for (const c of characters) {
      expect(buildCharacterSystemPrompt(c).startsWith(CHARACTER_PREAMBLE)).toBe(
        true,
      );
    }
  });

  it("tells the model which section holds its memories", () => {
    expect(CHARACTER_PREAMBLE).toContain("What you remember");
  });

  it("finds a character by slug", () => {
    expect(getCharacterBySlug("mira")?.name).toBe("Mira");
    expect(getCharacterBySlug("nobody")).toBeUndefined();
  });
});