import "dotenv/config";
import { resolve } from "node:path";
import { characters } from "@/lib/characters";
import { loadContent } from "@/lib/content/load";
import { planFacts } from "@/lib/content/ingest-plan";
import { syncFacts } from "@/lib/content/ingest";
import { gatewayConfig } from "@/lib/gateway/config";
import { createGateway } from "@/lib/gateway/gateway";
import { createOllamaProvider } from "@/lib/gateway/ollama";
import { prismaLogger } from "@/lib/gateway/prisma-logger";
import { prisma } from "@/lib/prisma";

const root = resolve(process.argv[2] ?? "content");

async function main() {
  const { docs, issues } = await loadContent(root);

  // Never store content that failed its checks.
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`ERROR ${e.path}${e.line ? `:${e.line}` : ""}  ${e.message}`);
    }
    throw new Error(`${errors.length} content errors: run npm run content:check`);
  }

  const planned = planFacts(docs, characters, gatewayConfig.models.embed);
  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: prismaLogger,
    config: gatewayConfig,
  });

  const started = performance.now();
  const result = await syncFacts({ prisma, gateway, planned });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  console.log(
    `Facts planned: ${planned.length}. Added ${result.added}, removed ${result.removed}, kept ${result.kept}. Took ${seconds} s.`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
