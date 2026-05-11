# Architecture

## Vue d'ensemble

Le système est composé de **4 services Docker** orchestrés par `docker-compose.yml`, communiquant sur le réseau Docker par défaut. Aucun service n'a besoin d'une connexion Internet après le pull initial du modèle Ollama.

```
┌──────────────────────────────────────────────────────────┐
│                     docker compose                        │
│                                                           │
│  ┌──────────────┐    ┌──────────────┐   ┌─────────────┐  │
│  │  Streamlit   │    │   FastAPI    │   │   Ollama    │  │
│  │  frontend    │◄──►│   backend    │──►│ LLM local   │  │
│  │  :8501       │    │   :8000      │   │ :11434      │  │
│  └──────────────┘    └──────┬───────┘   └─────────────┘  │
│                             │                             │
│                      ┌──────▼───────┐                     │
│                      │  ChromaDB    │                     │
│                      │  vector DB   │                     │
│                      │  :8100→:8000 │                     │
│                      └──────────────┘                     │
│                                                           │
│  Volumes : ./data/{uploads,chroma,logs,db}  ollama_data   │
└──────────────────────────────────────────────────────────┘
```

## Modules du backend

```
backend/
├── main.py            FastAPI app, mount des routes, startup
├── config.py          Settings centralisés (.env)
├── api/
│   ├── routes_health.py    GET  /api/health
│   ├── routes_upload.py    POST /api/upload, GET/DELETE /api/documents
│   ├── routes_quiz.py      POST /api/quiz/generate, /answer, GET /session/{id}
│   └── routes_stats.py     GET  /api/stats/{summary,history,topics}
├── services/
│   ├── document_processor.py   PyMuPDF + cleaning + chunking
│   ├── vectorstore.py          ChromaDB HttpClient + embeddings locaux
│   ├── llm_client.py           Ollama async via httpx + JSON parser robuste
│   ├── quiz_generator.py       RAG → prompt → parsing → persistence
│   ├── quiz_evaluator.py       Comparaison + explication LLM + log
│   ├── planner.py              Adaptation difficulté + sélection chunk
│   └── logger.py               Audit JSON Lines /data/logs
└── models/
    ├── schemas.py              Pydantic v2 (requêtes / réponses)
    └── database.py             SQLite (sessions, questions, answers, documents)
```

## Pipeline RAG

```
Fichier → extract_text (PyMuPDF/io) → _clean → chunk_text (≈500 t, overlap 50)
       → ChromaDB.upsert (sentence-transformers MiniLM-L6, cosine)

Quiz   → planner.compute_next_difficulty → planner.select_chunk
       → vectorstore.query (top_k, exclusion chunks récents)
       → llm.generate (prompt + system, format=json)
       → parse_json_response + _validate_payload
       → save_question + audit log

Answer → db.get_question
       → llm.generate (explication contextualisée)
       → db.save_answer + planner.compute_next_difficulty
       → audit log
```

## Persistance et données

| Données | Stockage | Volume Docker |
|---------|----------|---------------|
| Documents source | `data/uploads/` | bind mount |
| Chunks + embeddings | `data/chroma/` | bind mount → `/chroma/chroma` |
| Sessions, questions, réponses | `data/db/sessions.db` (SQLite) | bind mount |
| Logs JSON | `data/logs/audit-YYYY-MM-DD.jsonl` | bind mount |
| Modèle Ollama | volume nommé `ollama_data` | volume Docker |

`docker compose down` (sans `-v`) conserve toutes les données. `make reset` réinitialise tout.

## Choix techniques majeurs

- **HttpClient ChromaDB** (et non `chromadb-client` minimal) : on a besoin de la fonction d'embedding intégrée pour calculer les vecteurs côté backend, sans dépendance externe.
- **Embeddings locaux** (`all-MiniLM-L6-v2`, 80 Mo) : téléchargés une fois au build de l'image backend.
- **format JSON forcé** dans les prompts (`Ollama options.format=json`) + parser tolérant (fences markdown, prose autour) → bonne robustesse même avec des modèles 7B.
- **Adaptation 5 réponses** : fenêtre courte pour réagir vite, seuils 60 % / 90 % alignés sur la spec.
- **Anti-répétition** : exclusion des 20 derniers `chunk_id` utilisés dans la session.
- **SQLite mono-fichier** : zéro config, suffit pour un usage mono-utilisateur.
