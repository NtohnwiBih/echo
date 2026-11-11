/**
 * Reads a stream of newline-delimited JSON (what Ollama sends when streaming).
 * Network chunks can split a line, or even a multi-byte character, so we
 * buffer until we see a full line.
 */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    // If the consumer stopped early, cancelling closes the connection,
    // which tells Ollama to stop generating.
    await reader.cancel().catch(() => {});
  }
}
