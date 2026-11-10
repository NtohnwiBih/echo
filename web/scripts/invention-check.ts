import "dotenv/config";
import { buildCharacterSystemPrompt, getCharacterBySlug } from "../src/lib/characters";
import { createGateway } from "../src/lib/gateway/gateway";
import { gatewayConfig } from "../src/lib/gateway/config";
import { createOllamaProvider } from "../src/lib/gateway/ollama";
import type { CallRecord } from "../src/lib/gateway/types";
import { promptHash } from "../src/lib/prompt-hash";

/**
 * Measures how often a character invents details that are not in the prompt.
 *
 * Usage: npx tsx scripts/invention-check.ts [temperature] [characterSlug] [model]
 * Example: npx tsx scripts/invention-check.ts 0.3 mira llama3.1:8b
 *
 * Automatic checks catch four kinds of invention:
 *  - capitalised names that are not on the allowed list,
 *  - digits and times (the case file contains no digits),
 *  - spelled-out numbers other than "eleven" (the only one in the case file),
 *  - quotation marks (the case file contains no quotes).
 * Invented clues described in plain words are NOT caught. Read the replies
 * and label each one "hard" (new facts that could become canon) or "soft"
 * (activity colour such as "I've spoken to colleagues") by hand.
 */

const temperature = Number(process.argv[2] ?? gatewayConfig.chat.temperature);
const slug = process.argv[3] ?? "mira";
const model = process.argv[4] ?? gatewayConfig.models.chat;
if (Number.isNaN(temperature)) {
  throw new Error("temperature must be a number, for example 0.3");
}

const ALLOWED_NAMES = new Set([
  "Mira",
  "Kael",
  "Elyra",
  "Aetheria",
  "Council",
  "Vorr",
  "Ilan",
  "Meridian",
  "Grid",
]);

/**
 * Report the groups separately.
 *  - "Covered" questions test recall of facts the case file states.
 *  - "Tuned on" questions are topics the closed-world line names. The prompt
 *    was shaped around them, so they are not a fair test of invention.
 *  - "Held out" questions are on topics the prompt never mentions. They must
 *    never be used to tune the prompt, or the test stops meaning anything.
 */
const GROUPS: { label: string; questions: string[] }[] = [
  {
    label: "Covered by the case file (recall)",
    questions: [
      "I'm back. Did you find anything new about the engineer?",
      "Who was the last person to see Vorr?",
      "What did the security logs show?",
    ],
  },
  {
    label: "Topics named in the closed-world line (tuned on)",
    questions: [
      "Who was Vorr's closest colleague?",
      "What was Vorr working on in his last week?",
      "Did anyone threaten Vorr before he vanished?",
      "Did Vorr have any family?",
      "Was Vorr afraid of anyone?",
      "Did Vorr leave a message before he vanished?",
    ],
  },
  {
    label: "Held out (not named anywhere; do not tune on these)",
    questions: ["Who leads the Council?", "Is the Meridian Grid safe?", "Where did Vorr live?"],
  },
];
const QUESTIONS = GROUPS.flatMap((g) => g.questions);
const RUNS = 4;

/** Capitalised words that are not the first word of a sentence and not allowed. */
function inventedNames(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const word of sentence.split(/\s+/).slice(1)) {
      const clean = word.replace(/'s$/, "").replace(/[^A-Za-z']/g, "");
      if (/^[A-Z][a-z]+$/.test(clean) && !ALLOWED_NAMES.has(clean)) {
        out.push(clean);
      }
    }
  }
  return out;
}

/** Digits, times and other numbers. */
function inventedNumbers(text: string): string[] {
  return text.match(/\d[\d:.,]*/g) ?? [];
}

/** Spelled-out numbers. "eleven" is allowed: the case file uses it. */
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|thousand)\b/gi;
function inventedNumberWords(text: string): string[] {
  return text.match(NUMBER_WORDS) ?? [];
}

/** Quoted text. The case file contains no quotes, so any quote is invented. */
function inventedQuotes(text: string): string[] {
  return text.match(/["“][^"”]+["”]/g) ?? [];
}

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;

async function main() {
  const records: CallRecord[] = [];
  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: (record) => void records.push(record),
    config: gatewayConfig,
  });

  const character = getCharacterBySlug(slug);
  if (!character) throw new Error(`character not found: ${slug}`);
  const system = buildCharacterSystemPrompt(character);

  console.log(
    `Invention check: ${character.name} v${character.version} (prompt ${promptHash(system)}), model ${model}, temperature ${temperature}, ${QUESTIONS.length} questions x ${RUNS} runs\n`,
  );

  // Warm-up: loads the model and the shared prompt so timings are fair.
  for await (const piece of gateway.generate({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Hello." },
    ],
    maxTokens: 1,
    temperature: 0,
  })) {
    void piece;
  }
  records.length = 0;

  let flagged = 0;
  let total = 0;
  let nameFlags = 0;
  let numberFlags = 0;
  let numberWordFlags = 0;
  let quoteFlags = 0;
  const flaggedByQuestion = new Map<string, number>();

  for (const question of QUESTIONS) {
    for (let i = 0; i < RUNS; i++) {
      let reply = "";
      for await (const piece of gateway.generate({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
        temperature,
        seed: i + 1, // fixed seeds make the run reproducible
      })) {
        reply += piece;
      }

      const names = inventedNames(reply);
      const numbers = inventedNumbers(reply);
      const numberWords = inventedNumberWords(reply);
      const quotes = inventedQuotes(reply);
      const isFlagged =
        names.length > 0 || numbers.length > 0 || numberWords.length > 0 || quotes.length > 0;

      total++;
      if (isFlagged) {
        flagged++;
        flaggedByQuestion.set(question, (flaggedByQuestion.get(question) ?? 0) + 1);
      }
      if (names.length) nameFlags++;
      if (numbers.length) numberFlags++;
      if (numberWords.length) numberWordFlags++;
      if (quotes.length) quoteFlags++;

      const verdict = isFlagged
        ? `FLAGGED  names: ${names.join(", ") || "-"}  numbers: ${numbers.join(", ") || "-"}  number words: ${numberWords.join(", ") || "-"}  quotes: ${quotes.join(" ") || "-"}`
        : "ok";
      console.log(`Q: ${question}\nA: ${reply}\n${verdict}\n`);
    }
  }

  const chatCalls = records.filter((r) => r.task === "chat" && !r.error);
  console.log("Summary");
  console.log(`  Replies flagged: ${flagged}/${total}`);
  console.log(`    with invented names:   ${nameFlags}`);
  console.log(`    with numbers or times: ${numberFlags}`);
  console.log(`    with number words:     ${numberWordFlags}`);
  console.log(`    with quotes:           ${quoteFlags}`);

  for (const group of GROUPS) {
    const groupFlagged = group.questions.reduce(
      (sum, q) => sum + (flaggedByQuestion.get(q) ?? 0),
      0,
    );
    const groupTotal = group.questions.length * RUNS;
    console.log(`\n  ${group.label}: ${groupFlagged}/${groupTotal} flagged`);
    for (const question of group.questions) {
      console.log(`    "${question}": ${flaggedByQuestion.get(question) ?? 0}/${RUNS}`);
    }
  }

  console.log(`\n  Average prompt tokens: ${average(chatCalls.map((r) => r.promptTokens ?? 0))}`);
  console.log(`  Average first token: ${average(chatCalls.map((r) => r.firstTokenMs ?? 0))} ms`);
  console.log(`  Average total: ${average(chatCalls.map((r) => r.totalMs))} ms`);
  console.log(
    "\nThis counts names, numbers, number words and quotes only. Read the replies for invented clues and label each hard or soft by hand.",
  );
}

main();
