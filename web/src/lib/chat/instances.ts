import { gatewayConfig } from "../gateway/config";
import { createGateway } from "../gateway/gateway";
import { createOllamaProvider } from "../gateway/ollama";
import { prismaLogger } from "../gateway/prisma-logger";
import { SerialQueue } from "./queue";

export const gateway = createGateway({
  provider: createOllamaProvider(),
  log: prismaLogger,
  config: gatewayConfig,
});

// In development Next.js reloads modules on every save, which would create a
// new queue and forget who is waiting. Keeping one on globalThis avoids that.
const globalForQueue = globalThis as unknown as { chatQueue?: SerialQueue };
export const chatQueue = (globalForQueue.chatQueue ??= new SerialQueue());
