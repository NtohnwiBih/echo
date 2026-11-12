import { z } from "zod";
import { DEV_USER_ID } from "@/lib/chat/dev-user";
import { loadHistory, resolveConversation } from "@/lib/chat/conversations";
import { encodeEvent, type ChatEvent } from "@/lib/chat/events";
import { chatQueue, gateway } from "@/lib/chat/instances";
import { getCharacterBySlug } from "@/lib/characters";
import { DEFAULT_RETRIEVAL, retrieveFacts } from "@/lib/content/retrieve";
import { prisma } from "@/lib/prisma";
import { buildMessages } from "@/lib/prompt";

const bodySchema = z.object({
  character: z.string().min(1),
  message: z.string().trim().min(1).max(1000),
  conversationId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  const { character: slug, message, conversationId: requestedId } = parsed.data;

  const character = getCharacterBySlug(slug);
  const row = character ? await prisma.character.findUnique({ where: { slug } }) : null;
  if (!character || !row) {
    return Response.json({ error: "unknown character" }, { status: 404 });
  }

  const conversationId = await resolveConversation({
    userId: DEV_USER_ID,
    characterId: row.id,
    requestedId,
  });
  if (!conversationId) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }

  // History is read before the new message is saved, so it never includes it.
  const history = await loadHistory(conversationId);
  await prisma.message.create({
    data: { conversationId, role: "USER", content: message },
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          // the browser has gone away: nothing to send to
        }
      };

      send({ type: "queued", ahead: chatQueue.size });
      let reply = "";

      try {
        await chatQueue.run(async () => {
          const facts = await retrieveFacts({
            prisma,
            gateway,
            character: slug,
            question: message,
            options: DEFAULT_RETRIEVAL,
          });

          const assistant = await prisma.message.create({
            data: { conversationId, role: "ASSISTANT", content: "" },
            select: { id: true },
          });
          send({ type: "start", conversationId, messageId: assistant.id });

          try {
            for await (const piece of gateway.generate({
              messages: buildMessages({
                character,
                facts,
                history,
                userMessage: message,
              }),
              messageId: assistant.id,
              signal: request.signal,
            })) {
              reply += piece;
              send({ type: "delta", text: piece });
            }
          } finally {
            // Saves the whole reply, or whatever arrived if the stream broke.
            await prisma.message.update({
              where: { id: assistant.id },
              data: { content: reply },
            });
          }
        });
        send({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("chat failed", error);
          send({
            type: "error",
            message: "Mira can't answer right now. Please try again.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
