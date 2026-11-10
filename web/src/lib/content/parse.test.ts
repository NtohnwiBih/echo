import { describe, it, expect } from "vitest";
import { parseContentFile } from "./parse";
import { makeFile, validMeta } from "./test-utils";

describe("parseContentFile", () => {
  it("parses a valid file", () => {
    const { doc, issues } = parseContentFile(
      "world/test.md",
      makeFile(validMeta, ["Vorr led the Meridian Grid project."]),
    );
    expect(issues).toEqual([]);
    expect(doc?.meta.id).toBe("world-test");
    expect(doc?.title).toBe("A title");
    expect(doc?.facts).toEqual([{ text: "Vorr led the Meridian Grid project.", line: 8 }]);
  });

  it("fills in reliability when it is missing", () => {
    const { doc } = parseContentFile("world/test.md", makeFile(validMeta, ["A fact."]));
    expect(doc?.meta.reliability).toBe("confirmed");
  });

  it("reads a list and a boolean", () => {
    const text = makeFile(
      { ...validMeta, knownBy: "[mira, kael]", discover: "true", source: "Somewhere" },
      ["A fact."],
    );
    const { doc } = parseContentFile("world/test.md", text);
    expect(doc?.meta.knownBy).toEqual(["mira", "kael"]);
    expect(doc?.meta.discover).toBe(true);
  });

  it("rejects a file with no front matter", () => {
    const { doc, issues } = parseContentFile("world/test.md", "# Title\n- A fact.\n");
    expect(doc).toBeNull();
    expect(issues[0].message).toMatch(/must start with/);
  });

  it("rejects front matter that is never closed", () => {
    const { doc, issues } = parseContentFile("world/test.md", "---\nid: x\n# Title\n- A fact.\n");
    expect(doc).toBeNull();
    expect(issues[0].message).toMatch(/not closed/);
  });

  it("reports a mistyped key", () => {
    const { visibility, ...rest } = validMeta;
    void visibility;
    const text = makeFile({ ...rest, visibilty: "public" }, ["A fact."]);
    const { issues } = parseContentFile("world/test.md", text);
    expect(issues.some((i) => /unrecognized key/i.test(i.message))).toBe(true);
  });

  it("reports text that is not a heading or a bullet", () => {
    const text =
      "---\nid: world-test\nscope: world\nvisibility: public\nknownBy: all\n---\n# Title\nSome stray words.\n- A fact.\n";
    const { issues } = parseContentFile("world/test.md", text);
    expect(issues.some((i) => /not a heading or a bullet/.test(i.message))).toBe(true);
  });

  it("reports a file with no facts", () => {
    const { doc, issues } = parseContentFile("world/test.md", makeFile(validMeta, []));
    expect(doc).toBeNull();
    expect(issues.some((i) => /no facts/.test(i.message))).toBe(true);
  });
});
