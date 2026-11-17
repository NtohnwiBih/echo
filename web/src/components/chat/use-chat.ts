import { useReducer, useRef } from "react";
import { streamChat } from "@/lib/chat/client";
import { chatReducer, initialState } from "@/lib/chat/state";

export function useChat({ character, opening }: { character: string; opening: string }) {
  const [state, dispatch] = useReducer(chatReducer, opening, initialState);
  const abortRef = useRef<AbortController | null>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || state.status !== "idle") return;

    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "sent", id: crypto.randomUUID(), text: message });

    try {
      for await (const event of streamChat({
        character,
        message,
        conversationId: state.conversationId,
        signal: controller.signal,
      })) {
        dispatch({ type: "event", event });
      }
      dispatch({ type: "closed" }); // the stream ended without a done event
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "closed" }); // the player pressed Stop
      } else {
        dispatch({
          type: "failed",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return { state, send, stop };
}
