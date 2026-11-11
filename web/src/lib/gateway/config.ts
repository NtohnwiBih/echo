import type { GatewayConfig } from "./types";

export const gatewayConfig: GatewayConfig = {
  models: {
    // Provisional: chosen from small benchmarks (see DECISIONS.md).
    // The reply model is not decided yet; revisit after testing character voice.
    chat: "llama3.1:8b",
    extract: "llama3.1:8b",
    embed: "mxbai-embed-large", // 1024 dimensions
  },
  // mxbai expects this prefix on search queries, not on stored memories.
  embedQueryPrefix: "Represent this sentence for searching relevant passages: ",
  // 220 tokens is roughly 160 words: a hard stop above the 2-4 sentence rule.
  chat: { temperature: 0.8, maxTokens: 220 },
};
