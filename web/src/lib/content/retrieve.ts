import type { PrismaClient } from "@/generated/prisma/client";
import type { Gateway } from "../gateway/gateway";
import { toVectorLiteral } from "./vector";

export type RetrievedFact = {
  hash: string;
  text: string;
  docId: string;
  owner: string | null;
  audience: string[];
  reliability: "confirmed" | "reported" | "rumour";
  source: string | null;
  score: number; // cosine similarity: 1 means identical meaning, near 0 means unrelated
};

export type RetrievalOptions = {
  limit: number;
  minScore: number;
  maxPerDoc?: number; // at most this many facts from one document
};

export const DEFAULT_RETRIEVAL: RetrievalOptions = {
  limit: 5,
  minScore: 0.4,
  maxPerDoc: 3,
};

type SearchArgs = {
  prisma: PrismaClient;
  gateway: Gateway;
  character: string;
  question: string;
  candidates?: number;
};

/**
 * Finds the facts this character may state that are closest in meaning to the
 * question. The permission check happens here, in SQL. The cut-off is a
 * separate step (pickFacts), so the probe can look at the raw scores.
 */
export async function searchFacts({
  prisma,
  gateway,
  character,
  question,
  candidates = 12,
}: SearchArgs): Promise<RetrievedFact[]> {
  const literal = toVectorLiteral(await gateway.embedQuery(question));

  return prisma.$queryRaw<RetrievedFact[]>`
    SELECT hash, text, "docId", owner, audience, reliability, source,
           1 - (embedding <=> ${literal}::vector) AS score
    FROM "WorldFact"
    WHERE visibility = 'public'
      AND ${character}::text = ANY(audience)
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${candidates}
  `;
}

/** Keeps the facts that are close enough, best first, up to the limit and the per-document cap. */
export function pickFacts(
  candidates: RetrievedFact[],
  { limit, minScore, maxPerDoc = Number.POSITIVE_INFINITY }: RetrievalOptions,
): RetrievedFact[] {
  const perDoc = new Map<string, number>();
  const kept: RetrievedFact[] = [];

  const ranked = [...candidates]
    .filter((fact) => fact.score >= minScore)
    .sort((a, b) => b.score - a.score);

  for (const fact of ranked) {
    const used = perDoc.get(fact.docId) ?? 0;
    if (used >= maxPerDoc) continue; // this document already has its share
    perDoc.set(fact.docId, used + 1);
    kept.push(fact);
    if (kept.length === limit) break;
  }
  return kept;
}

/** Search, then apply the cut-off. This is what the chat endpoint will call. */
export async function retrieveFacts(
  args: SearchArgs & { options?: RetrievalOptions },
): Promise<RetrievedFact[]> {
  const found = await searchFacts(args);
  return pickFacts(found, args.options ?? DEFAULT_RETRIEVAL);
}
