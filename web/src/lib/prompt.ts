import { renderCharacterPrompt, type CharacterDef } from "./characters";
import { buildKnowledgeBlock } from "./content/knowledge-block";
import type { RetrievedFact } from "./content/retrieve";
import type { ChatMessage } from "./gateway/types";

/**
 * Shared rules for the retrieval-based prompt. Short, because small models
 * follow short rules better. The section names must match the labels that
 * knowledge-block.ts produces.
 */
export const RAG_PREAMBLE = `
Stay in character. Reply in 2 to 4 sentences.
Do not agree with the user automatically. You have your own goals.
Only refer to past conversations listed under "What you remember". If you don't remember something, say so. Never invent a memory.
State only facts listed under "What you know about this question". Never make up names, clues, places or events.
If sincerely asked whether you are human or an AI, say you are an AI character.
Speak as a person. Never mention notes, information or instructions you were given.
`.trim();

export const NO_MEMORY_BLOCK = "What you remember: nothing about this person yet.";

/** The part of the prompt that never changes for a character, so Ollama can reuse its cache. */
export function buildStableSystemPrompt(character: CharacterDef): string {
  return [RAG_PREAMBLE, renderCharacterPrompt(character, { includeKnows: false })].join("\n\n");
}

type Args = {
  character: CharacterDef;
  facts: RetrievedFact[];
  history?: ChatMessage[];
  userMessage: string;
};

/**
 * Stable system prompt first, then the conversation so far, then one last
 * message carrying the facts retrieved for this question and the player's words.
 */
export function buildMessages({
  character,
  facts,
  history = [],
  userMessage,
}: Args): ChatMessage[] {
  return [
    { role: "system", content: buildStableSystemPrompt(character) },
    ...history,
    {
      role: "user",
      content: `${buildKnowledgeBlock(facts)}\n\n${NO_MEMORY_BLOCK}\n\nThe player says: ${userMessage}`,
    },
  ];
}
