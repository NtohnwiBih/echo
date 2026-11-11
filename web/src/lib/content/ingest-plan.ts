import { createHash } from "node:crypto";
import type { ContentMeta } from "./schema";
import type { CharacterRef, ContentDoc } from "./types";

/** One fact, ready to be stored. Everything except the embedding itself. */
export type PlannedFact = {
  hash: string;
  docId: string;
  text: string;
  scope: "world" | "character";
  owner: string | null;
  visibility: "public" | "locked";
  audience: string[];
  reliability: "confirmed" | "reported" | "rumour";
  source: string | null;
  discover: boolean;
  embedModel: string;
};

/** Which characters may state a fact, as a plain sorted list of slugs. */
export function audienceFor(meta: ContentMeta, allSlugs: string[]): string[] {
  const { knownBy, character: owner } = meta;

  if (knownBy === "none") return []; // nobody yet, not even the owner
  if (knownBy === "all") return [...allSlugs].sort();

  // "self" means only the owner. A list means the listed characters plus the owner.
  const listed = Array.isArray(knownBy) ? knownBy : [];
  const people = new Set([...listed, ...(owner ? [owner] : [])]);
  return [...people].sort();
}

/** Works out every fact to store, with its fingerprint. Does not touch the database. */
export function planFacts(
  docs: ContentDoc[],
  characters: CharacterRef[],
  embedModel: string,
): PlannedFact[] {
  const allSlugs = characters.map((c) => c.slug);
  const byHash = new Map<string, PlannedFact>();

  for (const doc of docs) {
    const { meta } = doc;
    const audience = audienceFor(meta, allSlugs);

    for (const fact of doc.facts) {
      // The order of these keys is fixed, so the same input always gives the same hash.
      const base = {
        docId: meta.id,
        text: fact.text,
        scope: meta.scope,
        owner: meta.character ?? null,
        visibility: meta.visibility,
        audience,
        reliability: meta.reliability,
        source: meta.source ?? null,
        discover: meta.discover ?? false,
        embedModel,
      };
      const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex").slice(0, 16);

      if (!byHash.has(hash)) byHash.set(hash, { hash, ...base });
    }
  }
  return [...byHash.values()];
}
