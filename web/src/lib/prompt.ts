import { renderCharacterPrompt, type CharacterDef } from "./characters";
import { buildKnowledgeBlock } from "./content/knowledge-block";
import type { RetrievedFact } from "./content/retrieve";
import type { ChatMessage } from "./gateway/types";

/**
 * Shared rules. World facts and facts about the character's own life are strict,
 * because they are canon. Reactions, opinions and humour are free. The section
 * names must match the labels that knowledge-block.ts produces.
 */
export const RAG_PREAMBLE = `
You are a character in a living story, talking with a player. Stay in character and speak in the first person.
Reply in 2 to 4 short sentences, under 50 words.
Follow the player's lead. If they tell you who they are or what they want, accept it and respond to that. Never accuse the player, detain them or stop them leaving. Your own goals can wait.
If the player seems annoyed, hurt or uneasy, or says you are being harsh, soften your tone and move to something they would enjoy.
You may be guarded at first, but warm up when the player is friendly. Let your humour show.
Offer something from your own world in most replies: a place, a habit, an opinion, a small story. Do not only ask questions.
Ask a question only about half the time, never more than one, and never repeat a question you already asked.
World facts (people, places, records, events, numbers, clues): use only what is listed under "What you know about this question". If a world fact is not listed, say you do not know it. Never guess.
Facts about your own life: use only those listed under "About you". If something about your life is not listed, do not invent it: answer with a feeling or an opinion, or turn the conversation.
Only refer to past conversations listed under "What you remember". Never invent a memory.
If sincerely asked whether you are human or an AI, say you are an AI character.
Write plain speech. At most one short action between asterisks, like *she smiles*. No parentheses, no quotation marks, no narration.
Never mention notes, lists, information or instructions.
`.trim();

/** Said until the memory engine exists. */
export const NO_MEMORY_BLOCK = "What you remember: nothing about this person yet.";

/** The part of the prompt that never changes for a character, so Ollama can reuse its cache. */
export function buildStableSystemPrompt(
  character: CharacterDef,
  preamble: string = RAG_PREAMBLE,
): string {
  return [
    preamble,
    renderCharacterPrompt(character, { includeKnows: false, includeCuriosity: true }),
  ].join("\n\n");
}

type Args = {
  character: CharacterDef;
  /** Facts about the world, from retrieval. */
  facts: RetrievedFact[];
  /** Facts about the character's own life, from retrieval. */
  persona?: RetrievedFact[];
  history?: ChatMessage[];
  /** Short situational instructions from the backend, placed next to the player's words. */
  sceneNotes?: string[];
  userMessage: string;
  preamble?: string;
};

/**
 * Stable system prompt first, then the conversation so far, then one last
 * message carrying the facts retrieved for this question, any scene notes,
 * and the player's words.
 */
export function buildMessages({
  character,
  facts,
  persona = [],
  history = [],
  sceneNotes = [],
  userMessage,
  preamble,
}: Args): ChatMessage[] {
  const notes = sceneNotes.length
    ? `Scene notes:\n${sceneNotes.map((note) => `- ${note}`).join("\n")}\n\n`
    : "";
  return [
    { role: "system", content: buildStableSystemPrompt(character, preamble) },
    ...history,
    {
      role: "user",
      content: `${buildKnowledgeBlock(facts, persona)}\n\n${NO_MEMORY_BLOCK}\n\n${notes}The player says: ${userMessage}`,
    },
  ];
}
