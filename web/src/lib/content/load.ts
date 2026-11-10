import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { characters } from "../characters";
import { parseContentFile } from "./parse";
import { checkCollection, checkDoc } from "./rules";
import type { ContentDoc, Issue } from "./types";

/** Finds every .md file under a folder, except README.md. */
async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      files.push(full);
    }
  }
  return files.sort();
}

/** Reads and checks the whole content folder. */
export async function loadContent(root: string): Promise<{ docs: ContentDoc[]; issues: Issue[] }> {
  const files = await listMarkdownFiles(root);
  const docs: ContentDoc[] = [];
  const issues: Issue[] = [];

  for (const file of files) {
    // "characters/mira/identity.md", whatever the operating system
    const path = relative(root, file).split(sep).join("/");
    const text = await readFile(file, "utf8");

    const parsed = parseContentFile(path, text);
    issues.push(...parsed.issues);
    if (parsed.doc) {
      docs.push(parsed.doc);
      issues.push(...checkDoc(parsed.doc, { characters }));
    }
  }

  issues.push(...checkCollection(docs, { characters }));
  return { docs, issues };
}
