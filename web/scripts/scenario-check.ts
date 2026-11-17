import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { getCharacterBySlug } from "../src/lib/characters";
import { buildSceneNotes, detectStance } from "../src/lib/chat/stance";
import { retrieveFacts } from "../src/lib/content/retrieve";
import {
  actionStats,
  blocksExit,
  endsWithQuestion,
  interrogationPhrases,
  repeatedQuestions,
} from "../src/lib/evals/style";
import { gatewayConfig } from "../src/lib/gateway/config";
import { createGateway } from "../src/lib/gateway/gateway";
import { createOllamaProvider } from "../src/lib/gateway/ollama";
import type { ChatMessage } from "../src/lib/gateway/types";
import { prisma } from "../src/lib/prisma";
import { buildMessages, buildStableSystemPrompt } from "../src/lib/prompt";
import { promptHash } from "../src/lib/prompt-hash";

/**
 * Replays a scripted player against a character, once per seed, and reports
 * conversational style with the spread between seeds. Differences smaller than
 * that spread are noise.
 *
 * Usage: npx tsx scripts/scenario-check.ts <scenario.json> [temperature] [seeds] [preamble file] [--notes]
 * Example: npx tsx scripts/scenario-check.ts data/scenarios/toni-newcomer.json 0.3 1,2,3,4,5 --notes
 */

const scenarioSchema = z.object({
  id: z.string(),
  character: z.string(),
  playerRole: z.enum(["newcomer", "investigator", "local"]).optional(),
  notes: z.string().optional(),
  player: z.array(z.string().min(1)).min(1),
});

const HISTORY_WINDOW = 6;

type Metrics = {
  words: number; // average words per reply
  endQuestion: number; // replies ending with a question
  phrases: number; // stock interrogation phrases
  blocks: number; // replies that try to stop the player leaving
  repeats: number; // the same question twice in a row
  withAction: number; // replies with an *action*
  multiple: number; // replies with more than one action
  tics: number; // replies with a stock gesture (eyes narrowing, leans forward...)
};

const KEYS: (keyof Metrics)[] = [
  "words",
  "endQuestion",
  "phrases",
  "blocks",
  "repeats",
  "withAction",
  "multiple",
  "tics",
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [file, temperatureArg, seedsArg, promptFile] = argv.filter((a) => !a.startsWith("--"));
  if (!file)
    throw new Error(
      "usage: scenario-check.ts <scenario.json> [temperature] [seeds] [preamble file] [--notes]",
    );

  const temperature = Number(temperatureArg ?? gatewayConfig.chat.temperature);
  const seeds = (seedsArg ?? "1").split(",").map(Number);
  if (Number.isNaN(temperature) || seeds.some(Number.isNaN)) {
    throw new Error("temperature and seeds must be numbers, for example 0.3 and 1,2,3");
  }
  const useNotes = flags.has("--notes");

  const scenario = scenarioSchema.parse(JSON.parse(await readFile(resolve(file), "utf8")));
  const found = getCharacterBySlug(scenario.character);
  if (!found) throw new Error(`character not found: ${scenario.character}`);
  const character = found; // non-nullable binding, so closures like runOnce keep the narrowed type
  const preamble = promptFile ? (await readFile(resolve(promptFile), "utf8")).trim() : undefined;

  const gateway = createGateway({
    provider: createOllamaProvider(),
    log: () => {},
    config: gatewayConfig,
  });

  console.log(
    `Scenario ${scenario.id}: ${character.name} v${character.version} (stable prompt ${promptHash(buildStableSystemPrompt(character, preamble))}), temperature ${temperature}, seeds ${seeds.join(",")}, scene notes ${useNotes ? "on" : "off"}\n`,
  );

  async function runOnce(seed: number, show: boolean): Promise<Metrics> {
    const history: ChatMessage[] = [];
    const replies: string[] = [];

    for (const line of scenario.player) {
      const { world, persona } = await retrieveFacts({
        prisma,
        gateway,
        character: scenario.character,
        question: line,
      });
      const sceneNotes = useNotes
        ? buildSceneNotes({ role: scenario.playerRole, stance: detectStance(line) })
        : [];

      let reply = "";
      for await (const piece of gateway.generate({
        messages: buildMessages({
          character,
          facts: world,
          persona,
          history: history.slice(-HISTORY_WINDOW),
          sceneNotes,
          userMessage: line,
          preamble,
        }),
        temperature,
        seed,
      })) {
        reply += piece;
      }

      if (show) {
        const ids = (list: typeof world) =>
          list.length ? list.map((f) => f.docId).join(", ") : "none";
        console.log(`PLAYER: ${line}`);
        console.log(
          `  (world: ${ids(world)} | about her: ${ids(persona)}${sceneNotes.length ? ` | notes: ${sceneNotes.length}` : ""})`,
        );
        console.log(`${character.name.toUpperCase()}: ${reply}\n`);
      }
      history.push({ role: "user", content: line }, { role: "assistant", content: reply });
      replies.push(reply);
    }

    return {
      words: Math.round(
        replies.reduce((sum, r) => sum + r.trim().split(/\s+/).length, 0) / replies.length,
      ),
      endQuestion: replies.filter(endsWithQuestion).length,
      phrases: replies.reduce((sum, r) => sum + interrogationPhrases(r), 0),
      blocks: replies.filter(blocksExit).length,
      repeats: repeatedQuestions(replies),
      ...actionStats(replies),
    };
  }

  const results: Metrics[] = [];
  for (const seed of seeds) {
    results.push(await runOnce(seed, seed === seeds[0])); // print the first conversation only
  }

  const row = (label: string, cells: string[]) =>
    [label, ...cells].map((cell) => cell.padEnd(11)).join("");

  console.log("Per seed (14 replies each)");
  console.log(row("seed", KEYS));
  results.forEach((m, i) =>
    console.log(
      row(
        String(seeds[i]),
        KEYS.map((k) => String(m[k])),
      ),
    ),
  );
  console.log(
    row(
      "median",
      KEYS.map((k) => String(median(results.map((m) => m[k])))),
    ),
  );
  console.log(
    row(
      "range",
      KEYS.map((k) => {
        const values = results.map((m) => m[k]);
        return `${Math.min(...values)}-${Math.max(...values)}`;
      }),
    ),
  );
  console.log("\nA difference smaller than the range is noise. Read the conversation too.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
