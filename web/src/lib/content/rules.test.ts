import { describe, it, expect } from "vitest";
import { parseContentFile } from "./parse";
import { checkCollection, checkDoc } from "./rules";
import { makeFile, validMeta } from "./test-utils";
import type { ContentDoc, Issue } from "./types";

const characters = [
  { slug: "mira", name: "Mira" },
  { slug: "kael", name: "Kael" },
];

function parseOrFail(path: string, text: string): ContentDoc {
  const { doc, issues } = parseContentFile(path, text);
  if (!doc) throw new Error(`test file did not parse: ${JSON.stringify(issues)}`);
  return doc;
}

function check(meta: Record<string, string>, facts: string[], path = "world/test.md") {
  return checkDoc(parseOrFail(path, makeFile(meta, facts)), { characters });
}

const errors = (issues: Issue[]) => issues.filter((i) => i.level === "error").map((i) => i.message);
const warnings = (issues: Issue[]) =>
  issues.filter((i) => i.level === "warning").map((i) => i.message);

const goodFact = "Vorr led the Meridian Grid project.";
const miraMeta = {
  id: "mira-work",
  scope: "character",
  character: "mira",
  visibility: "public",
  knownBy: "all",
};

describe("checkDoc", () => {
  it("accepts a valid world file", () => {
    expect(check(validMeta, [goodFact])).toEqual([]);
  });

  it("accepts a valid character file", () => {
    expect(check(miraMeta, ["Mira is a detective."], "characters/mira/work.md")).toEqual([]);
  });

  it("accepts a locked file with knownBy none", () => {
    const meta = { ...validMeta, visibility: "locked", knownBy: "none" };
    expect(check(meta, [goodFact])).toEqual([]);
  });

  it("rejects digits", () => {
    const found = errors(check(validMeta, ["Vorr vanished 11 days ago."]));
    expect(found).toEqual([expect.stringContaining("digit")]);
  });

  it("rejects curly apostrophes", () => {
    const found = errors(check(validMeta, ["Vorr\u2019s badge was scanned."]));
    expect(found).toEqual([expect.stringContaining("curly")]);
  });

  it("requires a full stop", () => {
    const found = errors(check(validMeta, ["Vorr led the project"]));
    expect(found).toEqual([expect.stringContaining("full stop")]);
  });

  it("warns about a fact that starts with a pronoun", () => {
    const issues = check(validMeta, ["He led the Meridian Grid project."]);
    expect(errors(issues)).toEqual([]);
    expect(warnings(issues)).toEqual([expect.stringContaining("pronoun")]);
  });

  it("rejects a locked file that someone could state", () => {
    const meta = { ...validMeta, visibility: "locked" };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining("knownBy: none")]);
  });

  it("rejects knownBy none on a public file", () => {
    const meta = { ...validMeta, knownBy: "none" };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining("only for locked")]);
  });

  it("rejects an unknown character in knownBy", () => {
    const meta = { ...validMeta, knownBy: "[mira, zed]" };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining('"zed"')]);
  });

  it("rejects knownBy self in a world file", () => {
    const meta = { ...validMeta, knownBy: "self" };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining("character file")]);
  });

  it("rejects a discover file without a source", () => {
    const meta = { ...validMeta, discover: "true" };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining("source label")]);
  });

  it("never lets a locked secret appear on Discover", () => {
    const meta = {
      ...validMeta,
      visibility: "locked",
      knownBy: "none",
      discover: "true",
      source: "Somewhere",
    };
    expect(errors(check(meta, [goodFact]))).toEqual([expect.stringContaining("Discover")]);
  });

  it("checks that the folder matches the scope", () => {
    const found = errors(check(validMeta, [goodFact], "characters/mira/identity.md"));
    expect(found).toEqual([expect.stringContaining("must be inside world/")]);
  });

  it("checks that the character folder matches the character field", () => {
    const meta = { ...miraMeta, character: "kael" };
    const found = errors(check(meta, ["Kael is a soldier."], "characters/mira/work.md"));
    expect(found).toEqual([expect.stringContaining("characters/mira/")]);
  });

  it("warns when a character fact does not mention the character", () => {
    const issues = check(miraMeta, ["Records are sealed."], "characters/mira/work.md");
    expect(warnings(issues)).toEqual([expect.stringContaining("does not mention Mira")]);
  });
});

describe("checkCollection", () => {
  const first = parseOrFail("world/a.md", makeFile(validMeta, [goodFact]));
  const second = parseOrFail("world/b.md", makeFile(validMeta, [goodFact]));

  it("rejects a duplicate id", () => {
    const issues = checkCollection([first, second], { characters: [] });
    expect(errors(issues)).toEqual([
      expect.stringContaining('id "world-test" is already used by world/a.md'),
    ]);
  });

  it("warns about the same fact in two files", () => {
    const issues = checkCollection([first, second], { characters: [] });
    expect(warnings(issues)).toEqual([expect.stringContaining("same fact as world/a.md")]);
  });

  it("requires the six standard files for each character", () => {
    const issues = checkCollection([], { characters: [characters[0]] });
    expect(issues).toHaveLength(6);
    expect(issues.map((i) => i.path)).toContain("characters/mira/identity.md");
  });
});
