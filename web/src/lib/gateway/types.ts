export type ModelTask = "chat" | "extract" | "embed";

export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
};

export type EmbedResult = {
  vectors: number[][];
  usage: Usage;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  signal?: AbortSignal;
};

export type ChatChunk = { type: "delta"; text: string } | { type: "done"; usage: Usage };

/** Anything that can talk to a model. Ollama today, another provider later. */
export interface ModelProvider {
  embed(input: { model: string; texts: string[] }): Promise<EmbedResult>;
  chatStream(request: ChatRequest): AsyncGenerator<ChatChunk>;
}

/** One row for the ModelCall table. */
export type CallRecord = {
  task: ModelTask;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  firstTokenMs?: number;
  totalMs: number;
  error?: string;
  messageId?: string;
};

export type CallLogger = (record: CallRecord) => Promise<void> | void;

export type GatewayConfig = {
  models: { chat: string; extract: string; embed: string };
  embedQueryPrefix: string;
  chat: { temperature: number; maxTokens: number };
};
