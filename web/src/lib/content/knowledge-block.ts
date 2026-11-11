import type { RetrievedFact } from "./retrieve";

export const NO_INFORMATION_BLOCK = [
  "What you know about this question: nothing.",
  "You have no information about this topic. Say so in character in one or two sentences, and do not guess.",
].join("\n");

/** Said whenever facts are listed, because a nearby fact does not mean the answer is there. */
export const FALLBACK_LINE =
  "If none of this answers the question, say in character that you do not know.";

const LABELS: Record<RetrievedFact["reliability"], string> = {
  confirmed: "",
  reported: "(reported, not confirmed) ",
  rumour: "(rumour, not confirmed) ",
};

/**
 * The text added to the prompt for one question. With no facts, it tells the
 * character plainly that it knows nothing: the backend decides that, not the model.
 */
export function buildKnowledgeBlock(facts: RetrievedFact[]): string {
  if (facts.length === 0) return NO_INFORMATION_BLOCK;

  const lines = facts.map((fact) => `- ${LABELS[fact.reliability]}${fact.text}`);
  return ["What you know about this question:", ...lines, FALLBACK_LINE].join("\n");
}
