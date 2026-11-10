import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadContent } from "./load";

const contentDir = resolve(process.cwd(), "content");

describe("the real content folder", () => {
  it.skipIf(!existsSync(contentDir))("has no errors", async () => {
    const { issues } = await loadContent(contentDir);
    const errors = issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });
});
