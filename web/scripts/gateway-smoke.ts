import "dotenv/config";
import { buildCharacterSystemPrompt, getCharacterBySlug } from "../src/lib/characters";
import { createGateway } from "../src/lib/gateway/gateway";
import { gatewayConfig } from "../src/lib/gateway/config";
import { createOllamaProvider } from "../src/lib/gateway/ollama";
import { prismaLogger } from "../src/lib/gateway/prisma-logger";
import { prisma } from "../src/lib/prisma";

async function main() {
  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: prismaLogger,
    config: gatewayConfig,
  });

  const mira = getCharacterBySlug("mira");
  if (!mira) throw new Error("mira not found");

  const messages = [
    { role: "system" as const, content: buildCharacterSystemPrompt(mira) },
    {
      role: "user" as const,
      content: "I'm back. Did you find anything new about the engineer?",
    },
  ];

  const t0 = performance.now();
  let first: number | undefined;
  for await (const piece of gateway.generate({ messages })) {
    if (first === undefined) first = performance.now() - t0;
    process.stdout.write(piece);
  }
  console.log(
    `\n\nfirst token: ${Math.round(first ?? 0)} ms, total: ${Math.round(performance.now() - t0)} ms`,
  );
  await prisma.$disconnect();
}

main();
