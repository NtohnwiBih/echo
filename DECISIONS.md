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

---

## Benchmarks

| Model | Prompt | Valid JSON | Content captured (of 6) | Type errors | Gen tok/s | Total s |
|---|---|---|---|---|---|---|
| qwen2.5:7b | v1 | 5/5 | 5 | all typed "fact" | ~9.9 | 15-31 |
| llama3.1:8b | v1 | 3/3 | 4 | all typed "fact" | ~9.4 | 16-19 |
| qwen2.5:7b | v2 | 3/3 | 3 | preference typed "fact" | ~6.8 | 13.5 |
| llama3.1:8b | v2 | 3/3 | 6 | allergy typed "preference", importance 1 | ~6.8 | 31 |