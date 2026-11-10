export const validMeta = {
  id: "world-test",
  scope: "world",
  visibility: "public",
  knownBy: "all",
};

/** Builds the text of a content file from its parts. */
export function makeFile(meta: Record<string, string>, facts: string[], title = "A title"): string {
  const front = Object.entries(meta)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const bullets = facts.map((fact) => `- ${fact}`).join("\n");
  return `---\n${front}\n---\n# ${title}\n${bullets}\n`;
}
