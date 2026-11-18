import type { ChatMessage } from "../gateway/types";

/**
 * The text to search with. A short message like "what" means nothing alone, so
 * the character's last reply (without its actions) is added to give it a topic.
 */
export function retrievalQuery(message: string, history: ChatMessage[], minWords = 4): string {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  if (words >= minWords) return message;

  const lastReply = [...history].reverse().find((m) => m.role === "assistant");
  if (!lastReply) return message;

  const spoken = lastReply.content
    .replace(/\*[^*\n]+\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${spoken.slice(-300)}\n${message}`;
}
