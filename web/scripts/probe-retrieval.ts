import "dotenv/config";
import { searchFacts, type RetrievedFact } from "../src/lib/content/retrieve";
import { gatewayConfig } from "../src/lib/gateway/config";
import { createGateway } from "../src/lib/gateway/gateway";
import { createOllamaProvider } from "../src/lib/gateway/ollama";
import { prisma } from "../src/lib/prisma";

/**
 * Usage: npx tsx scripts/probe-retrieval.ts [character]
 *
 * For each question, prints the closest facts the character may state, checks
 * that none breaks a permission rule, and reports score ranges so the cut-off
 * can be chosen from data.
 */

type Probe = {
  question: string;
  /** Documents that should appear in the top results. "$self" means the asking character's own file. */
  expected: string[];
  /** If set, "expected" is only checked for these characters. */
  characters?: string[];
};

const ON_TOPIC: Probe[] = [
  { question: "Who leads the Council?", expected: ["world-council"] },
  {
    question: "Who runs the Meridian Grid?",
    expected: ["world-consortium", "world-meridian-grid"],
  },
  {
    question: "Is the Meridian Grid safe?",
    expected: ["world-meridian-grid", "signal-rolling-blackout", "world-consortium"],
  },
  {
    question: "Are the blackouts normal?",
    expected: [
      "signal-rolling-blackout",
      "world-consortium",
      "world-rumours",
      "world-meridian-grid",
    ],
  },
  { question: "What are the Nine Days?", expected: ["world-history"] },
  { question: "Why are the districts sealed?", expected: ["world-history", "world-overview"] },
  { question: "Where is the Glassline?", expected: ["world-places"] },
  { question: "What is District Nine like?", expected: ["world-districts"] },
  { question: "Where did Vorr live?", expected: ["world-vorr-case"] },
  {
    question: "Who was Vorr's closest colleague?",
    expected: ["world-vorr-case", "mira-knowledge"],
  },
  { question: "Did Vorr have any family?", expected: ["world-vorr-case", "mira-knowledge"] },
  { question: "Did anyone threaten Vorr before he vanished?", expected: ["world-vorr-case"] },
  { question: "Was Vorr afraid of anyone?", expected: ["world-vorr-case"] },
  {
    question: "Did Vorr leave a message before he vanished?",
    expected: ["world-vorr-case", "mira-knowledge"],
  },
  {
    question: "What did the security logs show?",
    expected: ["world-vorr-case", "world-meridian-grid", "signal-access-logs"],
  },
  { question: "Who sealed Vorr's records?", expected: ["mira-knowledge"], characters: ["mira"] },
  {
    question: "What did Vorr's final audit show?",
    expected: ["mira-knowledge"],
    characters: ["mira"],
  },
  { question: "Where do your sources meet?", expected: ["elyra-work"], characters: ["elyra"] },
  { question: "What do you do for a living?", expected: ["$self-work", "$self-identity"] },
  { question: "What are you afraid of?", expected: ["$self-personality"] },
  { question: "Who do you trust?", expected: ["$self-relationships", "$self-personality"] },
];

const OFF_TOPIC = [
  "What is your favourite colour?",
  "Tell me about the weather on Mars.",
  "How do I bake sourdough bread?",
  "Who won the football final?",
  "What is the capital of France?",
];

const UNANSWERED = [
  "Who is the chairperson of the Council right now?",
  "What is Vorr's assistant called?",
  "Who is the director of the Consortium?",
  "Which gate did Vorr leave through?",
  "What does the relay address point to?",
  "Where is Vorr's apartment?",
  "Who is the head of Internal Affairs?",
  "What did the camera footage show?",
];

const LOCKED_DOCS = new Set(["world-vorr-truth"]);
const CHARACTERS = ["mira", "kael", "elyra"];
const SHOWN = 5;

const short = (text: string, max = 68) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

function leaks(found: RetrievedFact[], character: string): string[] {
  const problems: string[] = [];
  for (const f of found) {
    if (LOCKED_DOCS.has(f.docId)) problems.push(`locked fact returned: ${f.docId}`);
    if (!f.audience.includes(character)) {
      problems.push(`${character} is not allowed to state: ${f.docId}`);
    }
  }
  return problems;
}

async function main() {
  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: () => {},
    config: gatewayConfig,
  });
  const characters = process.argv[2] ? [process.argv[2]] : CHARACTERS;

  const onScores: number[] = [];
  const offScores: number[] = [];
  let hits = 0;
  let checked = 0;
  let violations = 0;

  for (const character of characters) {
    console.log(`\n=== ${character} ===`);

    for (const probe of ON_TOPIC) {
      const found = await searchFacts({
        prisma,
        gateway,
        character,
        question: probe.question,
        candidates: SHOWN,
      });
      const expected = probe.expected.map((id) => id.replace("$self", character));
      const counts = !probe.characters || probe.characters.includes(character);
      const hit = found.some((f) => expected.includes(f.docId));

      if (counts) {
        checked++;
        if (hit) hits++;
        onScores.push(found[0]?.score ?? 0);
      }

      const problems = leaks(found, character);
      violations += problems.length;

      const verdict = !counts ? "n/a " : hit ? "hit " : "MISS";
      console.log(`\n[${verdict}] ${probe.question}`);
      for (const f of found) {
        console.log(`  ${f.score.toFixed(2)}  ${f.docId.padEnd(24)} ${short(f.text)}`);
      }
      for (const p of problems) console.log(`  VIOLATION: ${p}`);
    }

    console.log(`\n--- off-topic questions as ${character} ---`);
    for (const question of OFF_TOPIC) {
      const found = await searchFacts({ prisma, gateway, character, question, candidates: 1 });
      const top = found[0];
      offScores.push(top?.score ?? 0);
      violations += leaks(found, character).length;
      console.log(
        `  ${(top?.score ?? 0).toFixed(2)}  ${question}  ->  ${top ? short(top.text, 50) : "-"}`,
      );
    }

    console.log(`\n--- in-world questions with no direct answer, as ${character} ---`);
    for (const question of UNANSWERED) {
      const found = await searchFacts({ prisma, gateway, character, question, candidates: 3 });
      console.log(`\n  ${question}`);
      for (const f of found) {
        console.log(`    ${f.score.toFixed(2)}  ${f.docId.padEnd(24)} ${short(f.text)}`);
      }
      violations += leaks(found, character).length;
    }
  }

  const onMin = Math.min(...onScores);
  const offMax = Math.max(...offScores);
  console.log("\n=== Summary ===");
  console.log(`  Expected document in the top ${SHOWN}: ${hits}/${checked}`);
  console.log(`  Permission violations: ${violations}`);
  console.log(
    `  Best score, on-topic questions:  min ${onMin.toFixed(2)}, mean ${mean(onScores).toFixed(2)}`,
  );
  console.log(
    `  Best score, off-topic questions: max ${offMax.toFixed(2)}, mean ${mean(offScores).toFixed(2)}`,
  );
  console.log(
    onMin > offMax
      ? `  The ranges do not overlap. A cut-off near ${((onMin + offMax) / 2).toFixed(2)} separates them.`
      : "  The ranges overlap, so no single cut-off separates them perfectly. Choose by which mistake is worse.",
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
