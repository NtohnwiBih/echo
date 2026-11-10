import { metaSchema } from "./schema";
import type { ContentDoc, Fact, Issue } from "./types";

type RawValue = string | boolean | string[];
type RawMeta = Record<string, RawValue>;

const FENCE = "---";

function parseValue(raw: string): RawValue {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return value;
}

type Split =
  | { ok: true; raw: RawMeta; bodyLines: string[]; bodyStartLine: number }
  | { ok: false; message: string; line?: number };

/** Separates the front matter (between the --- lines) from the body. */
export function splitFrontMatter(text: string): Split {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  if (lines[0].trim() !== FENCE) {
    return { ok: false, message: "file must start with a line containing only ---", line: 1 };
  }
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (closing === -1) {
    return { ok: false, message: "front matter is not closed by a second --- line", line: 1 };
  }

  const raw: RawMeta = {};
  for (let i = 1; i < closing; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    const colon = line.indexOf(":");
    if (colon === -1) {
      return { ok: false, message: `front matter line has no colon: "${line}"`, line: i + 1 };
    }
    const key = line.slice(0, colon).trim();
    if (key === "") {
      return { ok: false, message: "front matter line has no key before the colon", line: i + 1 };
    }
    if (Object.hasOwn(raw, key)) {
      return { ok: false, message: `duplicate front matter key "${key}"`, line: i + 1 };
    }
    raw[key] = parseValue(line.slice(colon + 1));
  }

  return { ok: true, raw, bodyLines: lines.slice(closing + 1), bodyStartLine: closing + 2 };
}

/** Reads the title (# ...) and the facts (- ...) from the body. */
export function extractBody(
  bodyLines: string[],
  startLine: number,
): { title: string | null; facts: Fact[]; strays: Fact[] } {
  let title: string | null = null;
  const facts: Fact[] = [];
  const strays: Fact[] = [];

  for (const [index, line] of bodyLines.entries()) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const lineNumber = startLine + index;

    if (title === null && trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim();
    } else if (trimmed.startsWith("- ")) {
      facts.push({ text: trimmed.slice(2).trim(), line: lineNumber });
    } else {
      strays.push({ text: trimmed, line: lineNumber });
    }
  }
  return { title, facts, strays };
}

/** Reads one file. Returns the document if it is usable, plus every problem found. */
export function parseContentFile(
  path: string,
  text: string,
): { doc: ContentDoc | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const error = (message: string, line?: number) => {
    issues.push({ level: "error", path, line, message });
  };

  const split = splitFrontMatter(text);
  if (!split.ok) {
    error(split.message, split.line);
    return { doc: null, issues };
  }

  const result = metaSchema.safeParse(split.raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.map(String).join(".") || "front matter";
      error(`${field}: ${issue.message}`);
    }
    return { doc: null, issues };
  }

  const { title, facts, strays } = extractBody(split.bodyLines, split.bodyStartLine);
  for (const stray of strays) {
    error(`text that is not a heading or a bullet: "${stray.text}"`, stray.line);
  }
  if (title === null) error("missing a title line that starts with # ");
  if (facts.length === 0) error("has no facts (bullets that start with - )");
  if (title === null || facts.length === 0) return { doc: null, issues };

  return { doc: { path, meta: result.data, title, facts }, issues };
}
