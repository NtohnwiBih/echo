import type { ChatMessage } from "../gateway/types";
import { prisma } from "../prisma";

/** How many earlier messages go into the prompt. Six is three exchanges. */
export const HISTORY_WINDOW = 6;

/**
 * Returns the id of the conversation to use. With a requested id, the
 * conversation must belong to this user and this character, otherwise null.
 * This check is how one user is kept out of another user's conversations.
 */
export async function resolveConversation(args: {
  userId: string;
  characterId: string;
  requestedId?: string;
}): Promise<string | null> {
  const { userId, characterId, requestedId } = args;

  if (requestedId) {
    const found = await prisma.conversation.findFirst({
      where: { id: requestedId, userId, characterId },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  const created = await prisma.conversation.create({
    data: { userId, characterId },
    select: { id: true },
  });
  return created.id;
}

/** The most recent messages, oldest first. Empty replies (aborted before any text) are skipped. */
export async function loadHistory(
  conversationId: string,
  take = HISTORY_WINDOW,
): Promise<ChatMessage[]> {
  const recent = await prisma.message.findMany({
    where: { conversationId, content: { not: "" } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return recent.reverse().map((m): ChatMessage => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
}
