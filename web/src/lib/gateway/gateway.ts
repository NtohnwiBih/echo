import type {
  CallLogger,
  CallRecord,
  ChatMessage,
  GatewayConfig,
  ModelProvider,
  ModelTask,
  Usage,
} from "./types";

type Deps = {
  provider: ModelProvider;
  log: CallLogger;
  config: GatewayConfig;
};

export type GenerateInput = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  signal?: AbortSignal;
  messageId?: string;
};

export function createGateway({ provider, log, config }: Deps) {
  // Logging must never break a model call, so failures here are swallowed.
  async function safeLog(record: CallRecord) {
    try {
      await log(record);
    } catch (e) {
      console.error("gateway: failed to log model call", e);
    }
  }

  // Runs one model call, times it, and records the outcome either way.
  async function track<T>(
    task: ModelTask,
    model: string,
    run: () => Promise<{ value: T; usage?: Usage }>,
  ): Promise<T> {
    const start = performance.now();
    try {
      const { value, usage } = await run();
      await safeLog({
        task,
        model,
        ...usage,
        totalMs: Math.round(performance.now() - start),
      });
      return value;
    } catch (e) {
      await safeLog({
        task,
        model,
        totalMs: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  return {
    /** Embed a search query. Applies the model's query prefix. */
    async embedQuery(text: string): Promise<number[]> {
      const model = config.models.embed;
      return track("embed", model, async () => {
        const r = await provider.embed({
          model,
          texts: [config.embedQueryPrefix + text],
        });
        return { value: r.vectors[0], usage: r.usage };
      });
    },

    /** Embed memories to store. No prefix. */
    async embedDocuments(texts: string[]): Promise<number[][]> {
      const model = config.models.embed;
      return track("embed", model, async () => {
        const r = await provider.embed({ model, texts });
        return { value: r.vectors, usage: r.usage };
      });
    },

    /**
     * Streams a reply as text pieces. Records time to first token,
     * total time and token counts in one log row, even if the stream
     * fails or the caller stops reading early.
     */
    async *generate(input: GenerateInput): AsyncGenerator<string, void, void> {
      const model = input.model ?? config.models.chat;
      const start = performance.now();
      let firstTokenMs: number | undefined;
      let usage: Usage = {};
      let error: string | undefined;

      try {
        for await (const chunk of provider.chatStream({
          model,
          messages: input.messages,
          temperature: input.temperature ?? config.chat.temperature,
          maxTokens: input.maxTokens ?? config.chat.maxTokens,
          seed: input.seed,
          signal: input.signal,
        })) {
          if (chunk.type === "delta") {
            if (firstTokenMs === undefined && chunk.text) {
              firstTokenMs = Math.round(performance.now() - start);
            }
            yield chunk.text;
          } else {
            usage = chunk.usage;
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        await safeLog({
          task: "chat",
          model,
          ...usage,
          firstTokenMs,
          totalMs: Math.round(performance.now() - start),
          error,
          messageId: input.messageId,
        });
      }
    },
  };
}

export type Gateway = ReturnType<typeof createGateway>;