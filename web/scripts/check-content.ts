import { loadContent } from "@/lib/content/load";
import { ContentDoc, Issue } from "@/lib/content/types";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? "content");

const countFacts = (docs: ContentDoc[]) => docs.reduce((sum, doc) => sum + doc.facts.length, 0);

function format(issue: Issue): string {
  const where = issue.line ? `${issue.path}:${issue.line}` : issue.path;
  const tag = issue.level === "error" ? "ERROR  " : "warning";
  return `  ${tag} ${where}  ${issue.message}`;
}

async function main() {
  const { docs, issues } = await loadContent(root);

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const locked = docs.filter((d) => d.meta.visibility === "locked");
  const signals = docs.filter((d) => d.meta.discover);

  console.log(`Checked ${docs.length} files with ${countFacts(docs)} facts in ${root}`);
  console.log(`  locked facts: ${countFacts(locked)}, Discover signals: ${signals.length}`);

  if (issues.length > 0) {
    console.log();
    issues.sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0));
    for (const issue of issues) console.log(format(issue));
  }

  console.log(`\n${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
