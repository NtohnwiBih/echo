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
  limit: number; // the most facts to keep
  minScore: number; // facts scoring below this count as "not relevant"
  maxPerDoc?: number; // at most this many facts from one document
};

// Provisional: the probe and the rag check show where the real cut-offs belong.
export const WORLD_RETRIEVAL: RetrievalOptions = { limit: 5, minScore: 0.4, maxPerDoc: 3 };
export const PERSONA_RETRIEVAL: RetrievalOptions = { limit: 3, minScore: 0.35, maxPerDoc: 2 };
/** Kept so older scripts still compile. */
export const DEFAULT_RETRIEVAL = WORLD_RETRIEVAL;

type SearchArgs = {
  prisma: PrismaClient;
  gateway: Gateway;
  character: string;
  question: string;
  candidates?: number;
};

/**
 * Finds the facts this character may state, closest in meaning to the question.
 * The permission check happens here, in SQL. The cut-offs are applied later,
 * so the probe can look at the raw scores.
 */
export async function searchFacts({
  prisma,
  gateway,
  character,
  question,
  candidates = 200,
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
    if (used >= maxPerDoc) continue;
    perDoc.set(fact.docId, used + 1);
    kept.push(fact);
    if (kept.length === limit) break;
  }
  return kept;
}

export type Retrieved = { world: RetrievedFact[]; persona: RetrievedFact[] };

/** Facts from the character's own files are about them. Everything else is about the world. */
export function splitFacts(
  candidates: RetrievedFact[],
  character: string,
  world: RetrievalOptions = WORLD_RETRIEVAL,
  persona: RetrievalOptions = PERSONA_RETRIEVAL,
): Retrieved {
  return {
    world: pickFacts(
      candidates.filter((f) => f.owner !== character),
      world,
    ),
    persona: pickFacts(
      candidates.filter((f) => f.owner === character),
      persona,
    ),
  };
}

/** Search once, then split into world facts and facts about the character. */
export async function retrieveFacts(
  args: SearchArgs & { world?: RetrievalOptions; persona?: RetrievalOptions },
): Promise<Retrieved> {
  const found = await searchFacts(args);
  return splitFacts(found, args.character, args.world, args.persona);
}
