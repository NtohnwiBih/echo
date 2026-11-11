# ECHO: Decisions Log

Format for each entry: **Context → Options → Decision → Evidence → Revisit if...**

---

## 001: Run everything locally with Ollama
**Date:** 2026-11-02
**Context:** No budget for hosted inference or servers.
**Options:** Hosted API, rented GPU, local Ollama.
**Decision:** Local Ollama behind a model gateway, so the backend can be swapped later.
**Revisit if:** local latency makes the beta unusable.

## 002: Modular monolith, not microservices
**Context:** Solo developer, one laptop.
**Decision:** One TypeScript backend with clear module boundaries.
**Revisit if:** a component needs to scale or deploy independently.

## 003: Private memory only, scoped by user and character
**Context:** Shared world memory adds evidence validation, moderation and injection risks.
**Decision:** Implement private memory only. Keep a `scope_type` field so shared memory can be added later.
**Revisit if:** the beta has enough users for shared effects to be visible.

## 004: Postgres with pgvector in Docker
**Date:** 2026-11-02
**Context:** Need relational data and vector search for memories, on one laptop with limited RAM.
**Options:** Separate vector database, pgvector inside Postgres, SQLite plus a vector extension.
**Decision:** Postgres with pgvector in one container. One store keeps memory queries and access control in one place.
**Details:** Port bound to localhost only; password required via `.env` (`.env.example` committed); extension enabled in the first migration; no restart policy, so it doesn't use RAM during benchmarks.
**Revisit if:** vector search becomes slow at my real memory counts (measure in Phase 4).

## 005:
**Date:** 2026-11-02
**Evidence:** Two migrations applied: `init` (enables the vector extension, 0.8.7) and `add_core_tables` (User, Character, Conversation, Message, ModelCall). The first migration was empty apart from the extension because I generated it before adding models; I fixed it with a second migration instead of editing an applied one.
**Note:** `prisma migrate dev` does not generate the client in v7, so `prisma generate` runs separately (and in `postinstall`).

## 006: Embedding model: mxbai-embed-large (1024 dims)
**Context:** Memory retrieval needs an embedding model, and its dimension fixes the vector column size.
**Options:** nomic-embed-text (768 dims), mxbai-embed-large (1024 dims), each with and without prefixes.
**Decision:** mxbai-embed-large, queries prefixed, memories not prefixed.
**Evidence:** 12 answerable queries, 12 memories. Recall@3 12/12 vs 11/12 for nomic; score gap ~0.20 vs 0.09-0.13. About 25-29 ms per text for all variants. Small test, differences of one query are not significant.
**Design note:** Indirect queries (Whiskers cafe -> cat allergy) fail on every model. Always-include rule for high-importance memories (Phase 4).
**Revisit if:** Phase 3 retrieval evals on real extracted memories disagree, or RAM pressure from the 1024-dim model matters.

## 007: Characters defined in code, seeded into the database
**Context:** Character prompts change often while I tune them, and they need to be versioned.
**Decision:** Definitions live in `src/lib/characters.ts` (typed, tested) and `prisma db seed` upserts them. Shared rules (reply length, AI disclosure, crisis behaviour) are added by the prompt assembler, not stored per character.
**Dev user:** a seeded `dev-user` lets me test chat before auth exists. Remove it when login arrives in Phase 2.
**Revisit if:** non-developers need to edit characters (Phase 2+ creator tools).

## 008: Anti-invention measures for character replies
**Context:** With no facts to state, the character invents names, times and clues (observed in smoke tests).
**Changes:** world case file, `knows` lines per character, rules against inventing, fallback for missing details (prompt v4). Then true answers added to the case file for the questions players ask (last witness, badge, footage), and a closed-world line (prompt v5).
**Evidence (llama3.1:8b, Mira, temp 0.3, 24 replies, fixed seeds):** The names/numbers check flagged 5/24, but a hand count found about 11/24 hard inventions. Questions the case file answers improved (last witness: 2/4 inventing to 0/4). Questions it does not answer still invented (8/12 on the three unseen ones). Repeated defaults ("Elara Vex", "22:47") suggest learned defaults, not random improvisation.
**Metric fixes:** now also flags number words and quotation marks. Plain-word invented clues still need hand labelling (hard/soft).
**Decision:** chat temperature 0.3 (provisional). Reply model undecided pending the same check on qwen2.5:7b. Closed-world line tested next on six unseen questions.
**Revisit if:** replies read as flat at 0.3, the held-out group stays high, or the Phase 5 harness shows a different rate.
**Idea for later:** store a hash of the final prompt text with each model call, so a prompt change can never go unrecorded.

## 09: Retrieval needs a fallback line, and facts must be atomic
**Evidence:** probe 2 (218 facts, top 5): the expected document came back for 57/57 questions, with 0 permission violations. Scores measure topic closeness, not whether an answer exists: off-topic questions scored up to 0.51 and on-topic ones as low as 0.50 (first-person questions such as "What are you afraid of?"). A multi-idea bullet (audit, relay address, unknown) lost its ranking until split into three.
**Decision:** cut-off lowered to 0.40 (floor for nonsense only); the knowledge block always ends with a line telling the character to say it does not know when the facts do not answer. Content bullets carry one idea each.

## 010: Facts travel in the last message, not the system prompt
**Decision:** the system prompt (shared rules and character identity) is identical for every question so Ollama can cache it; retrieved facts and the player's message go in the final user message. The per-character `knows` list and the static world file are replaced by retrieval.
**Revisit if:** the model ignores facts placed in the user turn.

## 011: Retrieval-based prompt, first end-to-end measurement
**Evidence (llama3.1:8b, Mira, temp 0.3, 72 replies, one hand labeller):** 4 hard (5.6%, 95% interval roughly 2-13%), 7 borderline, 4 soft, 57 clean. On 6 questions with no matching fact: 1 hard in 24 (invented "Arin Vex"). Script flagged 8: 3 real, 5 false (4 x "Nine", 1 quoted reply); it missed 2 of 4 hard. Prompt 376 tokens (was 510); total 3.2 s (cached first token 470 ms flatters it). The no-information block never fired (0/18): in-world questions are always near some fact, so strictness rests on the fallback line.
**Problems found:** invented memories ("two days since we last spoke"); prompt leakage ("the information provided"); one document's near-identical bullets crowded out Mira's own knowledge; terse, repetitive voice.
**Changes:** explicit "nothing remembered" line, reworded fallback, max three facts per document, quote check ignores wrapped replies.
**Caveat:** the old held-out questions are no longer held out, since content was written after they failed.

---

## Benchmarks

| Model | Prompt | Valid JSON | Content captured (of 6) | Type errors | Gen tok/s | Total s |
|---|---|---|---|---|---|---|
| qwen2.5:7b | v1 | 5/5 | 5 | all typed "fact" | ~9.9 | 15-31 |
| llama3.1:8b | v1 | 3/3 | 4 | all typed "fact" | ~9.4 | 16-19 |
| qwen2.5:7b | v2 | 3/3 | 3 | preference typed "fact" | ~6.8 | 13.5 |
| llama3.1:8b | v2 | 3/3 | 6 | allergy typed "preference", importance 1 | ~6.8 | 31 |