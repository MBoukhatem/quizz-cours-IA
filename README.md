# Quizz-Cours-IA

Générateur de quiz pédagogiques multi-agents avec RAG. Provider LLM au choix :
OpenRouter (cloud, gratuit pour les modèles `:free`), OpenAI, ou vLLM local.

---

## Pourquoi

Les étudiants et formateurs qui veulent s'autoévaluer sur un cours ont besoin de questions fidèles
au contenu réel, pas à des connaissances génériques. Générer ces questions manuellement est long ;
un LLM seul hallucine ou sort du contexte. Un système multi-agents permet de séparer les
responsabilités : le **Router** décide de la source à consulter (cours interne ou web), l'**Agent
RAG** ancre les réponses dans les documents indexés, l'**Agent Outils** génère du JSON structuré
et évalue les réponses. Les embeddings restent locaux (Infinity / bge-m3), seule l'inférence LLM
peut être déléguée à un provider OpenAI-compatible.

---

## Architecture

Message utilisateur → **StateGraph LangGraph.js** → noeud **Router** (classifieur LLM, branche
`rag` ou `tools`) → **Agent RAG** (recherche vectorielle Qdrant, top-k=5) ou **Agent Outils**
(boucle ReAct : DuckDuckGo + `quiz_generator`) → **Aggregator** qui assemble citations, quiz et
texte final → émission **Server-Sent Events**. La mémoire de conversation est persistée dans
SQLite via le checkpointer LangGraph, par `thread_id`.

Voir le diagramme complet : [`docs/architecture.mmd`](docs/architecture.mmd).

---

## Stack

| Composant | Choix |
|---|---|
| Runtime | Node.js 22 + pnpm workspaces |
| Orchestration agents | LangGraph.js (StateGraph) |
| LLM | OpenAI-compatible — OpenRouter (par défaut), OpenAI, vLLM, Ollama… |
| Embeddings | Infinity local — BAAI/bge-m3, 1024 dims |
| Vector store | Qdrant (interne au compose) |
| HTTP framework | Fastify v5 + Zod type-provider |
| Mémoire / sessions | better-sqlite3 + `@langchain/langgraph-checkpoint-sqlite` |
| Interface web | React 19 + Vite + Tailwind v3 |
| Interface CLI | commander + ink |
| Recherche web | duck-duck-scrape (sans clé API) |
| Observabilité | pino (logs) |

---

## Quick start (PC externe, ~5 minutes)

### 1. Pré-requis

- **Docker** + **Docker Compose** v2
- **Une clé OpenRouter** gratuite — crée-la sur https://openrouter.ai/keys (les modèles `:free`
  marchent sans crédit, juste limités à ~50 req/jour)
- Optionnel : un GPU pour Infinity (CPU suffit, juste plus lent à l'upload)

### 2. Lancer Infinity (embeddings, à part)

Un seul container, ~1 Go RAM, gratuit, données privées :

```bash
docker run -d --name infinity -p 11436:7997 \
  michaelf34/infinity:latest \
  v2 --model-id BAAI/bge-m3 --port 7997
```

Avec GPU NVIDIA : ajoute `--gpus all` après `-d`.

### 3. Cloner + configurer

```bash
git clone https://github.com/MBoukhatem/quizz-cours-IA.git
cd quizz-cours-IA
cp .env.example .env
# Édite .env : remplace VLLM_API_KEY par ta clé OpenRouter (sk-or-v1-...)
```

### 4. Lancer la stack

```bash
docker compose up -d --build
```

3 containers démarrent : `qdrant`, `api`, `web`. Le port `4190` est exposé sur l'hôte.

### 5. Vérifier

```bash
curl http://localhost:4190/api/health
# {"status":"ok","services":{"vllm":"up","embeddings":"up","qdrant":"up"}}
```

Ouvre **http://localhost:4190/** dans Chrome → drop un PDF/MD → "Générer le quiz".

---

## Choix du modèle LLM

Édite `VLLM_MODEL` dans `.env`. Modèles free testés OpenRouter (tool calling supporté) :

| Modèle | Qualité FR | Notes |
|---|---|---|
| `google/gemini-2.0-flash-exp:free` | ⭐⭐⭐⭐⭐ | rapide, fiable, recommandé |
| `meta-llama/llama-3.3-70b-instruct:free` | ⭐⭐⭐⭐ | bon mais quota strict |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | ⭐⭐⭐⭐ | reasoning model, plus lent |
| `qwen/qwen3-235b-a22b:free` | ⭐⭐⭐⭐ | gros modèle, lent en free |

Modèles payants (~$0.0001/quiz) :
- `openai/gpt-4o-mini`
- `anthropic/claude-3.5-sonnet`
- `meta-llama/llama-3.3-70b-instruct`

Pour basculer sur **vLLM local** (Qwen3.5-35B sur GPU 24 Go) : commente les 3 lignes
OpenRouter dans `.env` et décommente le bloc vLLM. Lance vLLM séparément avant le `compose up`.

---

## Utilisation

### Ingérer + générer en CLI

```bash
docker compose run --rm cli health
docker compose run --rm cli ingest /app/data/uploads/mon_cours.pdf
```

### Via API (curl)

```bash
# Ingest
curl -X POST http://localhost:4190/api/ingest \
  -F "files=@cours_python.md"

# Générer un quiz (synchrone)
curl -X POST http://localhost:4190/api/quiz \
  -H 'content-type: application/json' \
  -d '{"threadId":"'$(uuidgen)'","source":"cours_python.md","numQuestions":5}'

# Soumettre des réponses
curl -X POST http://localhost:4190/api/quiz/submit \
  -H 'content-type: application/json' \
  -d '{"sessionId":"...","threadId":"...","answers":{"q0":"int","q1":"true"}}'
```

Voir [`docs/api_reference.md`](docs/api_reference.md) pour le détail des schémas.

---

## Tests et sécurité

- Tests : voir [`docs/tests.md`](docs/tests.md)
- Sécurité (prompt injection, rate-limit, validation) : voir [`docs/security.md`](docs/security.md)
- Décisions techniques : voir [`docs/decisions.md`](docs/decisions.md)

---

## Structure du repo

```
quizz-cours-ia/
├── packages/
│   ├── core/          # LLM, RAG, outils, graph LangGraph, mémoire
│   │   └── src/
│   │       ├── graph/     # StateGraph, Router, agents, Aggregator
│   │       ├── rag/       # loader, chunker, embeddings, Qdrant, retriever
│   │       ├── tools/     # quiz_generator, quiz_evaluator, web_search
│   │       ├── llm/       # client OpenAI-compat
│   │       └── memory/    # checkpointer SQLite, SessionStore
│   ├── api/           # Fastify — /health /ingest /chat /quiz/*
│   ├── cli/           # commander + ink — health ingest chat
│   └── web/           # React + Vite — upload, quiz player, eval view
├── docs/
│   ├── architecture.mmd
│   ├── api_reference.md
│   ├── decisions.md
│   ├── security.md
│   └── tests.md
├── scripts/
│   └── bootstrap-qdrant.ts
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Licence

Projet pédagogique — usage interne.
