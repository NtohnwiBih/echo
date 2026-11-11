import type { PrismaClient } from "@/generated/prisma/client";
import type { Gateway } from "../gateway/gateway";
import type { PlannedFact } from "./ingest-plan";
import { toVectorLiteral } from "./vector";

type Args = {
  prisma: PrismaClient;
  gateway: Gateway;
  planned: PlannedFact[];
  batchSize?: number;
};

export type SyncResult = { added: number; removed: number; kept: number };

/** Makes the database match the planned facts, embedding only what is new. */
export async function syncFacts({
  prisma,
  gateway,
  planned,
  batchSize = 32,
}: Args): Promise<SyncResult> {
  const existing = await prisma.worldFact.findMany({ select: { hash: true } });
  const wanted = new Set(planned.map((f) => f.hash));
  const have = new Set(existing.map((f) => f.hash));

  const stale = existing.filter((f) => !wanted.has(f.hash)).map((f) => f.hash);
  const fresh = planned.filter((f) => !have.has(f.hash));

  if (stale.length > 0) {
    await prisma.worldFact.deleteMany({ where: { hash: { in: stale } } });
  }

  for (let start = 0; start < fresh.length; start += batchSize) {
    const batch = fresh.slice(start, start + batchSize);
    const vectors = await gateway.embedDocuments(batch.map((f) => f.text));
    if (vectors.length !== batch.length) {
      throw new Error(`asked for ${batch.length} embeddings and got ${vectors.length}`);
    }

    for (const [index, fact] of batch.entries()) {
      const literal = toVectorLiteral(vectors[index]);
      // One transaction per fact: the row and its embedding are saved together
      // or not at all, so a crash can never leave a fact without an embedding.
      await prisma.$transaction([
        prisma.worldFact.create({ data: fact }),
        prisma.$executeRaw`UPDATE "WorldFact" SET embedding = ${literal}::vector WHERE hash = ${fact.hash}`,
      ]);
    }
  }

  return {
    added: fresh.length,
    removed: stale.length,
    kept: planned.length - fresh.length,
  };
}
