import { readNdjson } from "./ndjson";
import type { ModelProvider } from "./types";

type OllamaOptions = {
  baseUrl?: string;
  /**
   * Context window. Keep this CONSTANT across calls: a different value
   * can make Ollama reload the model. It also sets how much RAM the
   * conversation cache uses.
   */
  numCtx?: number;
  /** How long Ollama keeps the model in memory after a call. */
  keepAlive?: string;
};

type OllamaChatLine = {
  error?: string;
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
};

export function createOllamaProvider({
  baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  numCtx = 4096,
  keepAlive = "30m",
}: OllamaOptions = {}): ModelProvider {
  return {
    async embed({ model, texts }) {
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: texts, keep_alive: keepAlive }),
      });
      if (!res.ok) {
        throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as {
        embeddings: number[][];
        prompt_eval_count?: number;
      };
      return {
        vectors: json.embeddings,
        usage: { promptTokens: json.prompt_eval_count },
      };
    },

    async *chatStream({ model, messages, temperature, maxTokens, seed, signal }) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          keep_alive: keepAlive,
          options: {
            num_ctx: numCtx,
            temperature,
            num_predict: maxTokens,
            seed,
          },
        }),
        signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`);
      }

      for await (const raw of readNdjson(res.body)) {
        const line = raw as OllamaChatLine;
        if (line.error) throw new Error(line.error);
        if (line.message?.content) {
          yield { type: "delta", text: line.message.content };
        }
        if (line.done) {
          yield {
            type: "done",
            usage: {
              promptTokens: line.prompt_eval_count,
              completionTokens: line.eval_count,
            },
          };
        }
      }
    },
  };
}