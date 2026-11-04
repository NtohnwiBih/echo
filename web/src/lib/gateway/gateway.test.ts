import { describe, it, expect, vi } from "vitest";
import { createGateway } from "./gateway";
import type {
  CallRecord,
  ChatChunk,
  ChatRequest,
  GatewayConfig,
  ModelProvider,
} from "./types";

const config: GatewayConfig = {
  models: { chat: "chat-model", extract: "extract-model", embed: "embed-model" },
  embedQueryPrefix: "QUERY: ",
  chat: { temperature: 0.5, maxTokens: 100 },
};

function makeProvider(overrides: Partial<ModelProvider> = {}) {
  const embedInputs: string[][] = [];
  const chatRequests: ChatRequest[] = [];
  const provider: ModelProvider = {
    async embed({ texts }) {
      embedInputs.push(texts);
      return {
        vectors: texts.map((t) => [t.length]),
        usage: { promptTokens: 7 },
      };
    },
    async *chatStream(req): AsyncGenerator<ChatChunk> {
      chatRequests.push(req);
      yield { type: "delta", text: "Hel" };
      yield { type: "delta", text: "lo" };
      yield { type: "done", usage: { promptTokens: 12, completionTokens: 2 } };
    },
    ...overrides,
  };
  return { provider, embedInputs, chatRequests };
}

function setup(overrides?: Partial<ModelProvider>) {
  const made = makeProvider(overrides);
  const records: CallRecord[] = [];
  const gateway = createGateway({
    provider: made.provider,
    log: (r) => void records.push(r),
    config,
  });
  return { gateway, records, ...made };
}

async function collect(stream: AsyncIterable<string>) {
  let out = "";
  for await (const piece of stream) out += piece;
  return out;
}

describe("gateway.embed", () => {
  it("prefixes queries but not documents", async () => {
    const { gateway, embedInputs } = setup();
    await gateway.embedQuery("hello");
    await gateway.embedDocuments(["a", "b"]);
    expect(embedInputs[0]).toEqual(["QUERY: hello"]);
    expect(embedInputs[1]).toEqual(["a", "b"]);
  });

  it("logs one record per call, with model and token usage", async () => {
    const { gateway, records } = setup();
    await gateway.embedQuery("hello");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      task: "embed",
      model: "embed-model",
      promptTokens: 7,
    });
    expect(records[0].totalMs).toBeGreaterThanOrEqual(0);
    expect(records[0].error).toBeUndefined();
  });

  it("logs the error and rethrows when the provider fails", async () => {
    const { gateway, records } = setup({
      embed: async () => {
        throw new Error("boom");
      },
    });
    await expect(gateway.embedQuery("x")).rejects.toThrow("boom");
    expect(records[0].error).toBe("boom");
  });

  it("still returns the result when logging itself fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const gateway = createGateway({
      provider: makeProvider().provider,
      log: () => {
        throw new Error("db down");
      },
      config,
    });
    await expect(gateway.embedQuery("x")).resolves.toEqual([
        (config.embedQueryPrefix + "x").length,
    ]);
    spy.mockRestore();
  });
});

describe("gateway.generate", () => {
  const messages = [{ role: "user" as const, content: "hi" }];

  it("yields the text pieces in order", async () => {
    const { gateway } = setup();
    expect(await collect(gateway.generate({ messages }))).toBe("Hello");
  });

  it("logs one chat record with usage and time to first token", async () => {
    const { gateway, records } = setup();
    await collect(gateway.generate({ messages }));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      task: "chat",
      model: "chat-model",
      promptTokens: 12,
      completionTokens: 2,
    });
    expect(records[0].firstTokenMs).toBeGreaterThanOrEqual(0);
    expect(records[0].error).toBeUndefined();
  });

  it("applies the configured reply cap and temperature by default", async () => {
    const { gateway, chatRequests } = setup();
    await collect(gateway.generate({ messages }));
    expect(chatRequests[0]).toMatchObject({ maxTokens: 100, temperature: 0.5 });
  });

  it("lets the caller override model, temperature and seed", async () => {
    const { gateway, chatRequests } = setup();
    await collect(
      gateway.generate({ messages, model: "m2", temperature: 0, seed: 1 }),
    );
    expect(chatRequests[0]).toMatchObject({
      model: "m2",
      temperature: 0,
      seed: 1,
    });
  });

  it("logs the error, keeps partial timing, and rethrows if the stream fails", async () => {
    const { gateway, records } = setup({
      async *chatStream(): AsyncGenerator<ChatChunk> {
        yield { type: "delta", text: "partial" };
        throw new Error("boom");
      },
    });
    await expect(collect(gateway.generate({ messages }))).rejects.toThrow("boom");
    expect(records).toHaveLength(1);
    expect(records[0].error).toBe("boom");
    expect(records[0].firstTokenMs).toBeGreaterThanOrEqual(0);
  });

  it("logs exactly once when the caller stops reading early", async () => {
    const { gateway, records } = setup();
    for await (const piece of gateway.generate({ messages })) {
      void piece;
      break;
    }
    expect(records).toHaveLength(1);
    expect(records[0].error).toBeUndefined();
  });
});