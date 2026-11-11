import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { characters as realCharacters } from "../characters";
import { audienceFor, planFacts } from "./ingest-plan";
import { loadContent } from "./load";
import type { ContentMeta } from "./schema";
import type { ContentDoc } from "./types";

const characters = [
  { slug: "mira", name: "Mira" },
  { slug: "kael", name: "Kael" },
  { slug: "elyra", name: "Elyra" },
];
const slugs = characters.map((c) => c.slug);

function makeMeta(overrides: Partial<ContentMeta> = {}): ContentMeta {
  return {
    id: "world-test",
    scope: "world",
    visibility: "public",
    knownBy: "all",
    reliability: "confirmed",
    ...overrides,
  };
}

function makeDoc(overrides: Partial<ContentMeta> = {}, texts = ["A fact."]): ContentDoc {
  return {
    path: "world/test.md",
    meta: makeMeta(overrides),
    title: "A title",
    facts: texts.map((text, index) => ({ text, line: index + 8 })),
  };
}

describe("audienceFor", () => {
  it("lets every character state an all fact", () => {
    expect(audienceFor(makeMeta({ knownBy: "all" }), slugs)).toEqual(["elyra", "kael", "mira"]);
  });

  it("lets nobody state a none fact, even the owner", () => {
    const meta = makeMeta({ scope: "character", character: "mira", knownBy: "none" });
    expect(audienceFor(meta, slugs)).toEqual([]);
  });

  it("lets only the owner state a self fact", () => {
    const meta = makeMeta({ scope: "character", character: "mira", knownBy: "self" });
    expect(audienceFor(meta, slugs)).toEqual(["mira"]);
  });

  it("adds the owner to a list", () => {
    const meta = makeMeta({ scope: "character", character: "mira", knownBy: ["kael"] });
    expect(audienceFor(meta, slugs)).toEqual(["kael", "mira"]);
  });

  it("does not repeat the owner", () => {
    const meta = makeMeta({
      scope: "character",
      character: "mira",
      knownBy: ["mira", "kael"],
    });
    expect(audienceFor(meta, slugs)).toEqual(["kael", "mira"]);
  });

  it("uses just the list when there is no owner", () => {
    expect(audienceFor(makeMeta({ knownBy: ["elyra"] }), slugs)).toEqual(["elyra"]);
  });
});

describe("planFacts", () => {
  const plan = (docs: ContentDoc[], model = "embed-a") => planFacts(docs, characters, model);

  it("makes one planned fact per bullet", () => {
    expect(plan([makeDoc({}, ["One.", "Two."])])).toHaveLength(2);
  });

  it("gives the same hash for the same input", () => {
    expect(plan([makeDoc()])[0].hash).toBe(plan([makeDoc()])[0].hash);
  });

  it("changes the hash when the text changes", () => {
    expect(plan([makeDoc({}, ["A."])])[0].hash).not.toBe(plan([makeDoc({}, ["B."])])[0].hash);
  });

  it("changes the hash when who may know the fact changes", () => {
    const everyone = plan([makeDoc({ knownBy: "all" })])[0].hash;
    const onlyMira = plan([makeDoc({ knownBy: ["mira"] })])[0].hash;
    expect(everyone).not.toBe(onlyMira);
  });

  it("changes the hash when reliability changes", () => {
    const sure = plan([makeDoc({ reliability: "confirmed" })])[0].hash;
    const rumour = plan([makeDoc({ reliability: "rumour" })])[0].hash;
    expect(sure).not.toBe(rumour);
  });

  it("changes the hash when the embedding model changes", () => {
    expect(plan([makeDoc()], "embed-a")[0].hash).not.toBe(plan([makeDoc()], "embed-b")[0].hash);
  });

  it("keeps the same text in two documents as two facts", () => {
    const first = makeDoc({ id: "world-a" });
    const second = makeDoc({ id: "world-b" });
    expect(plan([first, second])).toHaveLength(2);
  });

  it("drops a fact written twice in the same document", () => {
    expect(plan([makeDoc({}, ["Same.", "Same."])])).toHaveLength(1);
  });

  it("keeps locked facts locked, with nobody allowed to state them", () => {
    const [fact] = plan([makeDoc({ visibility: "locked", knownBy: "none" })]);
    expect(fact.visibility).toBe("locked");
    expect(fact.audience).toEqual([]);
  });

  it("fills in defaults for optional fields", () => {
    const [fact] = plan([makeDoc()]);
    expect(fact).toMatchObject({ owner: null, source: null, discover: false });
  });
});

const contentDir = resolve(process.cwd(), "content");

describe("the plan for the real content", () => {
  it.skipIf(!existsSync(contentDir))("keeps every fact and every secret locked", async () => {
    const { docs } = await loadContent(contentDir);
    const total = docs.reduce((sum, doc) => sum + doc.facts.length, 0);
    const planned = planFacts(docs, realCharacters, "test-model");

    expect(planned).toHaveLength(total);
    for (const fact of planned) {
      if (fact.visibility === "locked") expect(fact.audience).toEqual([]);
      if (fact.visibility === "public") {
        expect(fact.audience.length).toBeGreaterThan(0);
      }
    }
  });
});
