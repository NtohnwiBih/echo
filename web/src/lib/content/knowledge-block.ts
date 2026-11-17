import type { RetrievedFact } from "./retrieve";

/** Used when no world fact was found. The character says so, and does not guess. */
export const NO_INFORMATION_BLOCK = [
  "What you know about this question: nothing.",
  "If it asks about the world or the case, say in character that you do not know. Do not guess.",
].join("\n");

/** Added after any list of world facts, because a nearby fact does not mean the answer is there. */
export const FALLBACK_LINE =
  "If a world fact you need is not listed here, say in character that you do not know it. Never guess.";

const LABELS: Record<RetrievedFact["reliability"], string> = {
  confirmed: "",
  reported: "(reported, not confirmed) ",
  rumour: "(rumour, not confirmed) ",
};

/**
 * The text added to the prompt for one question: what the world says, and what
 * is true about the character. The backend decides both lists, not the model.
 */
export function buildKnowledgeBlock(world: RetrievedFact[], persona: RetrievedFact[] = []): string {
  const parts: string[] = [];

  if (world.length === 0) {
    parts.push(NO_INFORMATION_BLOCK);
  } else {
    const lines = world.map((f) => `- ${LABELS[f.reliability]}${f.text}`);
    parts.push(["What you know about this question:", ...lines, FALLBACK_LINE].join("\n"));
  }

  if (persona.length > 0) {
    const lines = persona.map((f) => `- ${f.text}`);
    parts.push(["About you (say these as I):", ...lines].join("\n"));
  }
  return parts.join("\n\n");
}
