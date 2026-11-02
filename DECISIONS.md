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

---

## Benchmarks

| Model | Size / quant | Prompt tok/s | Gen tok/s | Model RAM | CPU/GPU |
|---|---|---|---|---|---|
| llama3.1:8b | (check with `ollama show`) | (measure) | ~9.4 | 5.6 GB | 100% CPU |
| qwen2.5:7b | (quant from `ollama show`) | 81 (1,096-token prompt) | 7.3 | ~5-6 GB | 100% CPU |