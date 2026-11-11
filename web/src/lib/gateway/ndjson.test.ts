import { describe, it, expect } from "vitest";
import { readNdjson } from "./ndjson";

function streamOfBytes(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

const enc = new TextEncoder();

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: unknown[] = [];
  for await (const item of readNdjson(stream)) out.push(item);
  return out;
}

describe("readNdjson", () => {
  it("parses one object per line", async () => {
    const out = await collect(streamOfBytes([enc.encode('{"a":1}\n{"a":2}\n')]));
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("handles a line split across chunks", async () => {
    const out = await collect(streamOfBytes([enc.encode('{"a":1}\n{"a"'), enc.encode(":2}\n")]));
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("handles a multi-byte character split across chunks", async () => {
    const bytes = enc.encode('{"t":"é"}\n'); // é is two bytes, at index 6 and 7
    const out = await collect(streamOfBytes([bytes.slice(0, 7), bytes.slice(7)]));
    expect(out).toEqual([{ t: "é" }]);
  });

  it("parses a final line with no trailing newline", async () => {
    const out = await collect(streamOfBytes([enc.encode('{"a":1}')]));
    expect(out).toEqual([{ a: 1 }]);
  });
});
