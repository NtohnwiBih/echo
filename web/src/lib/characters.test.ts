import { describe, it, expect } from "vitest";
import {
  CHARACTER_PREAMBLE,
  buildCharacterSystemPrompt,
  characters,
  getCharacterBySlug,
  renderCharacterPrompt,
} from "./characters";
import { WORLD_CASE_FILE } from "./world";

// Rough estimate: 1 token is about 4 characters of English. It runs about
// 20% high against the real count (see the promptTokens column of ModelCall).
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
        c.knows,
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

  it("renders what the character knows", () => {
    for (const c of characters) {
      expect(renderCharacterPrompt(c)).toContain("What you know:");
    }
  });

  it("keeps the full system prompt within the token budget", () => {
    for (const c of characters) {
      expect(estimateTokens(buildCharacterSystemPrompt(c))).toBeLessThan(640);
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

  it("includes the world case file after the shared rules", () => {
    for (const c of characters) {
      const prompt = buildCharacterSystemPrompt(c);
      expect(prompt).toContain(WORLD_CASE_FILE);
      expect(prompt.indexOf(WORLD_CASE_FILE)).toBeGreaterThan(
        prompt.indexOf(CHARACTER_PREAMBLE),
      );
    }
  });

  it("uses section names that match the prompt labels", () => {
    expect(CHARACTER_PREAMBLE).toContain("What you remember");
    expect(CHARACTER_PREAMBLE).toContain("What is publicly known");
    expect(CHARACTER_PREAMBLE).toContain("What you know");
    expect(WORLD_CASE_FILE.startsWith("What is publicly known")).toBe(true);
  });

  it("keeps digits out of the world case file", () => {
    // The invention check treats any digit in a reply as invented,
    // so the case file must spell numbers out (for example "eleven").
    expect(WORLD_CASE_FILE).not.toMatch(/\d/);
  });

  it("finds a character by slug", () => {
    expect(getCharacterBySlug("mira")?.name).toBe("Mira");
    expect(getCharacterBySlug("nobody")).toBeUndefined();
  });
});