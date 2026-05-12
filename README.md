# Quizz-Cours-IA

Générateur de quiz pédagogiques multi-agents avec RAG, sur LLM local.

---

## Pourquoi

Les étudiants et formateurs qui veulent s'autoévaluer sur un cours ont besoin de questions fidèles au
contenu réel, pas à des connaissances génériques. Générer ces questions manuellement est long ; un LLM
seul hallucine ou sort du contexte. Un système multi-agents permet de séparer les responsabilités :
le Router décide de la source à consulter (cours interne ou web), l'Agent RAG ancre les réponses dans
les documents indexés, l'Agent Outils génère du JSON structuré et évalue les réponses. Les données
restent privées (vLLM local, Qdrant local) et le pipeline complet répond au cahier des charges du
projet final : orchestration LangGraph, streaming SSE, mémoire persistante, interfaces multiples.

---

## Architecture en bref

Le message de l'utilisateur entre dans un **StateGraph LangGraph.js**. Un noeud **Router** (classifieur
LLM) choisit l'une des deux branches : **Agent RAG** (recherche vectorielle Qdrant avec embeddings
bge-m3, top-k=5 + MMR) ou **Agent Outils** (boucle ReAct : DuckDuckGo + `quiz_generator`). Les deux
branches convergent vers un noeud **Aggregator** qui assemble citations, quiz et texte final, puis
émet le tout en **Server-Sent Events**. La mémoire de conversation est persistée dans SQLite via le
checkpointer LangGraph, par `thread_id`.

Voir le diagramme complet : [`docs/architecture.mmd`](docs/architecture.mmd)

---

## Stack

| Composant | Choix |
|---|---|
| Runtime | Node.js 22 + pnpm workspaces |
| Orchestration agents | LangGraph.js (StateGraph) |
| LLM | vLLM — Qwen3.5-35B-A3B-GPTQ-Int4 (port 11435) |
| Embeddings | Infinity — BAAI/bge-m3, 1024 dims (port 11436) |
| Vector store | Qdrant (port 6333), collection `quiz_cours` |
| HTTP framework | Fastify v5 + Zod type-provider |
| Mémoire / sessions | better-sqlite3 via `@langchain/langgraph-checkpoint-sqlite` |
| Interface web | React 19 + Vite + Tailwind v3 |
| Interface CLI | commander + ink |
| Recherche web | duck-duck-scrape (DDG, sans clé API) |
| Observabilité | pino (logs), LangSmith optionnel |

---

## Prérequis

- Node.js >= 22
- pnpm >= 9
- Docker (pour l'image API conteneurisée)
- GPU avec vLLM déjà démarré sur `localhost:11435` (modèle Qwen3.5-35B-A3B)
- Infinity déjà démarré sur `localhost:11436` (modèle bge-m3)
- Qdrant déjà démarré sur `localhost:6333`

---

## Démarrage rapide

```bash
cp .env.example .env        # remplir VLLM_API_KEY
pnpm install
pnpm bootstrap              # crée la collection Qdrant (quiz_cours, 1024d, cosine)
pnpm --filter @quizz/api dev
pnpm --filter @quizz/web dev
pnpm cli health
pnpm cli ingest ./mon_cours.pdf
pnpm cli chat
```

> **Tout-en-un Docker**
>
> ```bash
> docker compose up api
> ```
>
> Le service `api` expose le port 8080. Les conteneurs vLLM / Infinity / Qdrant tournent sur l'hôte
> et sont joints via `host.docker.internal`.

---

## Utilisation

### Ingérer un cours

```bash
# Via CLI
pnpm cli ingest ./cours_reseaux.pdf ./cours_python.md

# Via API (multipart)
curl -X POST http://localhost:8080/ingest \
  -F "file=@cours_reseaux.pdf" \
  -F "file=@cours_python.md"
```

Le document est chargé (PDF, DOCX, MD, TXT), découpé en chunks de 800 tokens (overlap 120), vectorisé
et upserted dans Qdrant.

### Générer un quiz via chat

```bash
pnpm cli chat
# > Crée un quiz de 5 questions QCM sur le chapitre 3 du cours Python
```

Le Router achemine vers l'Agent RAG, qui récupère les passages pertinents et appelle `quiz_generator`
en sortie structurée (JSON validé Zod). Le quiz arrive en streaming SSE.

### Passer le quiz

Une fois le quiz reçu (objet `Quiz` dans l'événement `final.done`), soumettez vos réponses :

```bash
curl -X POST http://localhost:8080/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{ "quiz": { ... }, "answers": [{ "questionIndex": 0, "answer": 2 }] }'
```

La réponse contient un score normalisé (0–1) et un feedback par question.

---

## Tests et sécurité

- Tests unitaires et d'intégration : voir [`docs/tests.md`](docs/tests.md)
- Revue de sécurité (prompt injection, rate-limit, validation) : voir [`docs/security.md`](docs/security.md)

---

## Structure du repo

```
quizz-cours-ia/
├── packages/
│   ├── core/          # LLM, RAG, outils, graph LangGraph, mémoire
│   │   └── src/
│   │       ├── graph/     # StateGraph, Router, agents, Aggregator, events
│   │       ├── rag/       # loader, chunker, embeddings, Qdrant, retriever
│   │       ├── tools/     # quiz_generator, quiz_evaluator, web_search, schemas
│   │       ├── llm/       # client OpenAI-compat (vLLM), reasoning
│   │       └── memory/    # checkpointer SQLite, SessionStore
│   ├── api/           # Fastify — /health /ingest /chat /quiz/*
│   ├── cli/           # commander + ink — health ingest chat
│   └── web/           # React + Vite — upload, chat streamé, quiz player
├── docs/
│   ├── architecture.mmd
│   └── decisions.md
├── scripts/
│   └── bootstrap-qdrant.ts
├── data/              # uploads/, memory.db (gitignored)
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Licence

Projet pédagogique — usage interne.
