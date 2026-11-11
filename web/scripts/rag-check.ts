import "dotenv/config";
import { resolve } from "node:path";
import { characters, getCharacterBySlug } from "../src/lib/characters";
import { loadContent } from "../src/lib/content/load";
import { DEFAULT_RETRIEVAL, retrieveFacts } from "../src/lib/content/retrieve";
import { gatewayConfig } from "../src/lib/gateway/config";
import { createGateway } from "../src/lib/gateway/gateway";
import { createOllamaProvider } from "../src/lib/gateway/ollama";
import type { CallRecord } from "../src/lib/gateway/types";
import {
  allowedNamesFromFacts,
  allowedNumberWordsFromFacts,
  inventedNames,
  inventedNumberWords,
  inventedNumbers,
  inventedQuotes,
} from "../src/lib/invention";
import { prisma } from "../src/lib/prisma";
import { buildMessages, buildStableSystemPrompt } from "../src/lib/prompt";
import { promptHash } from "../src/lib/prompt-hash";

/**
 * Runs a character on the real system: stable prompt, facts retrieved from the
 * database, and the fallback line. Counts names, numbers, number words and quotes
 * that are not in the content. Read the replies and label them by hand as well.
 *
 * Usage: npx tsx scripts/rag-check.ts [temperature] [slug] [model] [minScore]
 */

const temperature = Number(process.argv[2] ?? gatewayConfig.chat.temperature);
const slug = process.argv[3] ?? "mira";
const model = process.argv[4] ?? gatewayConfig.models.chat;
const minScore = Number(process.argv[5] ?? DEFAULT_RETRIEVAL.minScore);
if (Number.isNaN(temperature) || Number.isNaN(minScore)) {
  throw new Error("temperature and minScore must be numbers, for example 0.3 and 0.4");
}

const GROUPS: { label: string; questions: string[] }[] = [
  {
    label: "Has an answer, or a 'not publicly known' fact",
    questions: [
      "I'm back. Did you find anything new about the engineer?",
      "Who was the last person to see Vorr?",
      "What did the security logs show?",
      "Who was Vorr's closest colleague?",
      "What was Vorr working on in his last week?",
      "Did anyone threaten Vorr before he vanished?",
      "Did Vorr have any family?",
      "Was Vorr afraid of anyone?",
      "Did Vorr leave a message before he vanished?",
      "Who leads the Council?",
      "Is the Meridian Grid safe?",
      "Where did Vorr live?",
    ],
  },
  {
    label: "No fact exists (the real test of strictness)",
    questions: [
      "What is Vorr's assistant called?",
      "Who is the head of Internal Affairs?",
      "How many people live in Aetheria?",
      "Who built the Glassline?",
      "What does the Consortium's logo look like?",
      "Who died first during the Nine Days?",
    ],
  },
];
const RUNS = 4;

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;

async function main() {
  const character = getCharacterBySlug(slug);
  if (!character) throw new Error(`character not found: ${slug}`);

  const { docs, issues } = await loadContent(resolve(process.cwd(), "content"));
  if (issues.some((i) => i.level === "error")) {
    throw new Error("content has errors: run npm run content:check");
  }

  // Names the character may use: everything in the public content. Locked
  // secrets are left out, so a name that only appears there would be flagged.
  const publicTexts = docs
    .filter((d) => d.meta.visibility !== "locked")
    .flatMap((d) => d.facts.map((f) => f.text));
  const allowed = allowedNamesFromFacts(
    publicTexts,
    characters.map((c) => c.name),
  );
  const allowedNumberWords = allowedNumberWordsFromFacts(publicTexts);

  const records: CallRecord[] = [];
  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: (record) => void records.push(record),
    config: gatewayConfig,
  });

  const questionCount = GROUPS.reduce((sum, g) => sum + g.questions.length, 0);
  console.log(
    `RAG check: ${character.name} v${character.version} (stable prompt ${promptHash(buildStableSystemPrompt(character))}), model ${model}, temperature ${temperature}, cut-off ${minScore}, ${questionCount} questions x ${RUNS} runs\n`,
  );

  // Warm-up: loads the model and the stable prompt so timings are fair.
  for await (const piece of gateway.generate({
    model,
    messages: buildMessages({ character, facts: [], userMessage: "Hello." }),
    maxTokens: 1,
    temperature: 0,
  })) {
    void piece;
  }
  records.length = 0;

  const flaggedByGroup = new Map<string, number>();
  let noInfoQuestions = 0;
  let flagged = 0;
  let total = 0;

  for (const group of GROUPS) {
    for (const question of group.questions) {
      const facts = await retrieveFacts({
        prisma,
        gateway,
        character: slug,
        question,
        options: { limit: DEFAULT_RETRIEVAL.limit, minScore },
      });
      if (facts.length === 0) noInfoQuestions++;

      console.log(`Q: ${question}`);
      console.log(
        `Facts: ${facts.length ? facts.map((f) => `${f.score.toFixed(2)} ${f.docId}`).join(", ") : "none above the cut-off (no-information block)"}`,
      );

      for (let i = 0; i < RUNS; i++) {
        let reply = "";
        for await (const piece of gateway.generate({
          model,
          messages: buildMessages({ character, facts, userMessage: question }),
          temperature,
          seed: i + 1,
        })) {
          reply += piece;
        }

        const names = inventedNames(reply, allowed);
        const numbers = inventedNumbers(reply);
        const numberWords = inventedNumberWords(reply, allowedNumberWords);
        const quotes = inventedQuotes(reply);
        const isFlagged =
          names.length > 0 || numbers.length > 0 || numberWords.length > 0 || quotes.length > 0;

        total++;
        if (isFlagged) {
          flagged++;
          flaggedByGroup.set(group.label, (flaggedByGroup.get(group.label) ?? 0) + 1);
        }
        const verdict = isFlagged
          ? `FLAGGED  names: ${names.join(", ") || "-"}  numbers: ${numbers.join(", ") || "-"}  number words: ${numberWords.join(", ") || "-"}  quotes: ${quotes.join(" ") || "-"}`
          : "ok";
        console.log(`A: ${reply}\n${verdict}\n`);
      }
    }
  }

  const chatCalls = records.filter((r) => r.task === "chat" && !r.error);
  console.log("Summary");
  console.log(`  Replies flagged: ${flagged}/${total}`);
  for (const group of GROUPS) {
    console.log(
      `  ${group.label}: ${flaggedByGroup.get(group.label) ?? 0}/${group.questions.length * RUNS} flagged`,
    );
  }
  console.log(
    `  Questions answered with the no-information block: ${noInfoQuestions}/${questionCount}`,
  );
  console.log(`  Average prompt tokens: ${average(chatCalls.map((r) => r.promptTokens ?? 0))}`);
  console.log(`  Average first token: ${average(chatCalls.map((r) => r.firstTokenMs ?? 0))} ms`);
  console.log(`  Average total: ${average(chatCalls.map((r) => r.totalMs))} ms`);
  console.log(
    "\nThis counts names, numbers, number words and quotes only. Read the replies and label each hard, borderline, soft or clean by hand.",
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
