import { CHARACTER_FILES } from "./schema";
import type { CharacterRef, ContentDoc, Issue, Level } from "./types";

export type RuleOptions = { characters: CharacterRef[] };

const DIGIT = /\d/;
// \u2018 \u2019 \u201C \u201D are the curly single and double quotes.
const CURLY_QUOTES = /[\u2018\u2019\u201C\u201D]/;
const STARTS_WITH_PRONOUN = /^(he|she|his|her|him|they|their|them|this|that|these|those)\b/i;
const MAX_FACT_LENGTH = 220;

/** Rules that apply to one file on its own. */
export function checkDoc(doc: ContentDoc, { characters }: RuleOptions): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Level, message: string, line?: number) => {
    issues.push({ level, path: doc.path, line, message });
  };

  const { meta } = doc;
  const slugs = characters.map((c) => c.slug);
  const folders = doc.path.split("/"); // for example ["characters", "mira", "identity.md"]

  // The folder must agree with the scope.
  if (meta.scope === "world") {
    if (folders[0] !== "world") {
      add("error", `scope is world, so the file must be inside world/ (it is in ${folders[0]}/)`);
    }
    if (meta.character) add("error", "world files must not have a character field");
  } else {
    if (folders[0] !== "characters") {
      add(
        "error",
        `scope is character, so the file must be inside characters/ (it is in ${folders[0]}/)`,
      );
    }
    if (!meta.character) {
      add("error", "character files need a character field");
    } else {
      if (!slugs.includes(meta.character)) {
        add("error", `unknown character "${meta.character}" (known: ${slugs.join(", ")})`);
      }
      if (folders[1] !== meta.character) {
        add("error", `character is ${meta.character} but the file is in characters/${folders[1]}/`);
      }
    }
  }

  // knownBy must mean something.
  const { knownBy } = meta;
  if (Array.isArray(knownBy)) {
    for (const slug of knownBy) {
      if (!slugs.includes(slug)) add("error", `knownBy lists unknown character "${slug}"`);
    }
  } else if (knownBy === "self") {
    if (meta.scope !== "character")
      add("error", "knownBy: self only makes sense in a character file");
  } else if (knownBy !== "all" && knownBy !== "none") {
    add("error", `knownBy must be all, self, none or a list like [mira], not "${knownBy}"`);
  }

  // Locked secrets: nobody may state them yet, and they never reach Discover.
  const isNone = knownBy === "none";
  if (meta.visibility === "locked" && !isNone) {
    add("error", "locked facts must have knownBy: none until the story unlocks them");
  }
  if (meta.visibility === "public" && isNone) {
    add(
      "error",
      "knownBy: none is only for locked files; nobody could ever state these public facts",
    );
  }
  if (meta.discover && !meta.source) add("error", "discover files need a source label");
  if (meta.discover && meta.visibility === "locked") {
    add("error", "locked secrets must never appear on Discover");
  }

  // Rules for each fact.
  const owner = meta.character ? characters.find((c) => c.slug === meta.character) : undefined;
  for (const { text, line } of doc.facts) {
    if (DIGIT.test(text)) {
      add(
        "error",
        "contains a digit; spell numbers out (the invention check treats digits as invented)",
        line,
      );
    }
    if (CURLY_QUOTES.test(text)) {
      add(
        "error",
        "contains a curly quote or apostrophe; use straight ones in content files",
        line,
      );
    }
    if (!text.endsWith(".")) add("error", "does not end with a full stop", line);
    if (text.length > MAX_FACT_LENGTH) {
      add(
        "warning",
        `is ${text.length} characters long; consider splitting it into two facts`,
        line,
      );
    }
    if (STARTS_WITH_PRONOUN.test(text)) {
      add(
        "warning",
        "starts with a pronoun, so it may not make sense on its own; name the subject",
        line,
      );
    }
    if (owner && !text.toLowerCase().includes(owner.name.toLowerCase())) {
      add("warning", `does not mention ${owner.name}, so it may not make sense on its own`, line);
    }
  }

  return issues;
}

/** Rules that compare files with each other. */
export function checkCollection(docs: ContentDoc[], { characters }: RuleOptions): Issue[] {
  const issues: Issue[] = [];

  // Every id must be unique.
  const byId = new Map<string, ContentDoc>();
  for (const doc of docs) {
    const earlier = byId.get(doc.meta.id);
    if (earlier) {
      issues.push({
        level: "error",
        path: doc.path,
        message: `id "${doc.meta.id}" is already used by ${earlier.path}`,
      });
    } else {
      byId.set(doc.meta.id, doc);
    }
  }

  // The same fact written twice is probably a mistake.
  const seen = new Map<string, string>();
  for (const doc of docs) {
    for (const fact of doc.facts) {
      const key = fact.text.toLowerCase();
      const earlier = seen.get(key);
      if (earlier) {
        issues.push({
          level: "warning",
          path: doc.path,
          line: fact.line,
          message: `same fact as ${earlier}`,
        });
      } else {
        seen.set(key, `${doc.path}:${fact.line}`);
      }
    }
  }

  // Every character needs the six standard files.
  const paths = new Set(docs.map((d) => d.path));
  for (const { slug } of characters) {
    for (const file of CHARACTER_FILES) {
      const expected = `characters/${slug}/${file}.md`;
      if (!paths.has(expected)) {
        issues.push({
          level: "error",
          path: expected,
          message: "required character file is missing",
        });
      }
    }
  }

  return issues;
}
