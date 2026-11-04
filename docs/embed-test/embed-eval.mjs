import { readFileSync } from "node:fs";

const OLLAMA = "http://localhost:11434";
const data = JSON.parse(readFileSync(new URL("./embed-testset.json", import.meta.url)));

const variants = [
  { label: "nomic (prefixes)", model: "nomic-embed-text", q: "search_query: ", d: "search_document: " },
  { label: "nomic (no prefix)", model: "nomic-embed-text", q: "", d: "" },
  { label: "mxbai (prefix)", model: "mxbai-embed-large", q: "Represent this sentence for searching relevant passages: ", d: "" },
  { label: "mxbai (no prefix)", model: "mxbai-embed-large", q: "", d: "" },
];

async function embed(model, texts) {
  const t0 = performance.now();
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { vectors: json.embeddings, ms: performance.now() - t0 };
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const results = [];

for (const v of variants) {
  console.log(`\nRunning ${v.label}...`);
  await embed(v.model, ["warm up"]); // loads the model; not timed
  const docs = await embed(v.model, data.memories.map((m) => v.d + m.text));
  const qs = await embed(v.model, data.queries.map((q) => v.q + q.text));

  let hit1 = 0, hit3 = 0, rr = 0, scored = 0;
  const answerTop = [], noAnswerTop = [], misses = [];

  data.queries.forEach((q, qi) => {
    const ranked = data.memories
      .map((m, mi) => ({ id: m.id, score: cosine(qs.vectors[qi], docs.vectors[mi]) }))
      .sort((a, b) => b.score - a.score);

    if (q.expected === null) {
      noAnswerTop.push(ranked[0].score);
      return;
    }
    scored++;
    const rank = ranked.findIndex((r) => r.id === q.expected) + 1;
    if (rank === 1) hit1++;
    if (rank <= 3) hit3++;
    rr += 1 / rank;
    answerTop.push(ranked[0].score);
    if (rank > 1) {
      misses.push(`  [${q.kind}] "${q.text}" expected ${q.expected}, got rank ${rank} (top was ${ranked[0].id})`);
    }
  });

  console.log(misses.length ? misses.join("\n") : "  no misses");
  results.push({
    variant: v.label,
    dims: docs.vectors[0].length,
    "recall@1": `${hit1}/${scored}`,
    "recall@3": `${hit3}/${scored}`,
    MRR: (rr / scored).toFixed(2),
    "best score (has answer)": avg(answerTop).toFixed(2),
    "best score (no answer)": avg(noAnswerTop).toFixed(2),
    "ms per text": ((docs.ms + qs.ms) / (data.memories.length + data.queries.length)).toFixed(0),
  });
}

console.log("");
console.table(results);
