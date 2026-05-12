# Architecture Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Monorepo tooling | pnpm workspaces | Native workspace protocol, fast installs, no extra build tool required for simple setups |
| HTTP framework | Fastify v5 | Lower overhead than Express, first-class TypeScript + Zod type-provider, built-in SSE support |
| Orchestration | LangGraph.js | Stateful agent graphs with built-in checkpointing; same mental model as Python LangGraph |
| Embeddings endpoint | `POST /embeddings` (no `/v1/` prefix) | Infinity's OpenAI-compat layer uses `/v1/embeddings` but the raw Infinity API is at `/embeddings`; `404` confirmed on `/v1/` path |
| LLM client | `openai` SDK pointing at vLLM | vLLM exposes an OpenAI-compatible `/v1` API; reusing the official SDK avoids custom HTTP code |
| Checkpointing | better-sqlite3 via `@langchain/langgraph-checkpoint-sqlite` | Single-file DB, zero infra, easy Docker volume mount |
| Vector store | Qdrant | Supports bge-m3 (1024 dims), fast filtering, already running on host |
| Web search | duck-duck-scrape | No API key required, DDG ToS-acceptable scraping for RAG augmentation |
| Container networking | `extra_hosts: host.docker.internal:host-gateway` | Routes container traffic to host services (vLLM, Infinity, Qdrant) without exposing them on a shared Docker network |
| Frontend build | Vite + React 19 + Tailwind v3 | Fast HMR, small output; Tailwind v3 chosen for PostCSS compatibility over v4 alpha |
