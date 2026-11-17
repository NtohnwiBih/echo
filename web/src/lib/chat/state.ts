import type { ChatEvent } from "./events";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type ChatStatus = "idle" | "queued" | "streaming";

export type ChatState = {
  messages: UiMessage[];
  status: ChatStatus;
  /** How many requests are ahead of ours in the queue. */
  ahead: number;
  conversationId?: string;
  error: string | null;
};

export type ChatAction =
  | { type: "sent"; id: string; text: string }
  | { type: "event"; event: ChatEvent }
  | { type: "failed"; message: string }
  | { type: "closed" };

export function initialState(opening?: string): ChatState {
  return {
    messages: opening ? [{ id: "opening", role: "assistant", text: opening }] : [],
    status: "idle",
    ahead: 0,
    error: null,
  };
}

/** Drops an assistant message that never received any text. */
function withoutEmptyReply(messages: UiMessage[]): UiMessage[] {
  const last = messages[messages.length - 1];
  return last && last.role === "assistant" && last.text === "" ? messages.slice(0, -1) : messages;
}

function applyEvent(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "queued":
      return { ...state, status: "queued", ahead: event.ahead };
    case "start":
      return {
        ...state,
        status: "streaming",
        ahead: 0,
        conversationId: event.conversationId,
        messages: [...state.messages, { id: event.messageId, role: "assistant", text: "" }],
      };
    case "delta": {
      const last = state.messages[state.messages.length - 1];
      if (!last || last.role !== "assistant") return state;
      return {
        ...state,
        messages: [...state.messages.slice(0, -1), { ...last, text: last.text + event.text }],
      };
    }
    case "done":
      return { ...state, status: "idle", ahead: 0 };
    case "error":
      return {
        ...state,
        status: "idle",
        ahead: 0,
        error: event.message,
        messages: withoutEmptyReply(state.messages),
      };
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "sent":
      return {
        ...state,
        messages: [...state.messages, { id: action.id, role: "user", text: action.text }],
        status: "queued",
        ahead: 0,
        error: null,
      };
    case "event":
      return applyEvent(state, action.event);
    case "failed":
      return {
        ...state,
        status: "idle",
        ahead: 0,
        error: action.message,
        messages: withoutEmptyReply(state.messages),
      };
    case "closed":
      return { ...state, status: "idle", ahead: 0 };
  }
}
