# Tuteur Quiz Adaptatif

Agent IA local qui aide un étudiant à réviser son cours en générant des **QCM** à partir de ses propres supports (PDF, Markdown, TXT) via un pipeline **RAG**. Tout tourne en **local** avec **Ollama** : aucune API cloud payante, **100 % gratuit**.

> Spécification complète : [`Resume_Project.md`](./Resume_Project.md)

## Stack

| Composant | Technologie | Rôle |
|-----------|------------|------|
| LLM local | Ollama + Mistral 7B | Génération QCM et explications |
| Backend | FastAPI 0.115 (Python 3.11) | API REST, orchestration RAG |
| Frontend | Streamlit 1.40 | Upload, quiz, dashboard |
| Vector DB | ChromaDB 0.5 | Indexation des chunks de cours |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | Vecteurs locaux (384-dim) |
| Extraction PDF | PyMuPDF | Texte page-à-page |
| Sessions | SQLite (volume Docker) | Scores, historique, traçabilité |

## Prérequis

- Docker ≥ 24 et Docker Compose ≥ 2.20
- 8 Go de RAM (modèle `mistral:7b`) — sinon basculer sur `phi3:mini`
- ~5 Go d'espace disque (image du modèle)
- `make` (facultatif, raccourcis)

## Démarrage rapide

```bash
# 1. Cloner / récupérer le projet, puis copier le .env si besoin
cp .env.example .env

# 2. Lancer la stack
make run         # équivalent à: docker compose up -d --build

# 3. Télécharger le modèle Ollama (à faire une fois Ollama healthy)
make pull-model  # équivalent à: bash scripts/init_ollama.sh

# 4. (Optionnel) indexer le corpus d'exemple
bash scripts/seed_corpus.sh
```

Puis ouvrir :

- **Frontend Streamlit** : <http://localhost:8501>
- **API + Swagger UI** : <http://localhost:8000/docs>
- **Health check** : <http://localhost:8000/api/health>

Pour arrêter :

```bash
make stop     # arrêt simple
make down     # arrêt + suppression des conteneurs (volumes conservés)
make reset    # remise à zéro complète (efface data/)
```

## Utilisation

1. **Upload** d'un cours via la page Streamlit `📤 Upload` (ou `POST /api/upload`). Le document est extrait, nettoyé, découpé en chunks (~500 tokens, overlap 50), puis indexé dans ChromaDB.
2. **Quiz** via la page `🎯 Quiz` (ou `POST /api/quiz/generate`). Le planificateur choisit une difficulté (facile / moyen / difficile) selon votre score récent. Le RAG sélectionne un chunk non encore utilisé, le LLM génère un QCM strictement basé sur ce chunk.
3. **Réponse** : `POST /api/quiz/answer` corrige, génère une explication citant le passage source et adapte la difficulté.
4. **Dashboard** : la page `📊 Dashboard` montre le taux de réussite global, la progression par session, la performance par document.

## Endpoints API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET     | `/api/health` | Statut des composants (Ollama, ChromaDB) |
| POST    | `/api/upload` | Indexer un fichier (form-data `file`) |
| GET     | `/api/documents` | Liste des documents indexés |
| DELETE  | `/api/documents/{id}` | Supprimer un document |
| POST    | `/api/quiz/generate` | Générer une question QCM |
| POST    | `/api/quiz/answer` | Corriger une réponse |
| GET     | `/api/quiz/session/{id}` | État d'une session |
| GET     | `/api/stats/summary` | Statistiques globales |
| GET     | `/api/stats/history` | Historique des sessions |
| GET     | `/api/stats/topics` | Performance par document |

Détails : [`docs/api_reference.md`](./docs/api_reference.md).

## Architecture

```
┌──────────────┐    ┌──────────────┐   ┌─────────────┐
│  Streamlit   │    │   FastAPI    │   │   Ollama    │
│  port 8501   │◄──►│  port 8000   │──►│ port 11434  │
└──────────────┘    └──────┬───────┘   └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  ChromaDB    │
                    │  port 8100   │
                    └──────────────┘

Volumes : ./data/{uploads,chroma,logs,db}
```

## Tests

Lancer les tests pytest **dans le conteneur** :

```bash
make test
# ou
docker compose exec backend pytest -v
```

Les tests utilisent des stubs pour Ollama et ChromaDB — ils ne dépendent pas du modèle pulled. Cibles couvertes :

- `test_document_processor.py` — extraction, nettoyage, chunking
- `test_planner.py` — adaptation de difficulté
- `test_quiz_generator.py` — parsing JSON, validation de payload
- `test_api.py` — flux end-to-end via `TestClient`

## Configuration

Toutes les variables sont dans `.env` (voir `.env.example`). Les plus importantes :

| Variable | Défaut | Effet |
|----------|--------|-------|
| `OLLAMA_MODEL` | `mistral:7b` | Modèle Ollama à utiliser. Alternatives : `phi3:mini`, `llama3:8b`, `gemma2:9b` |
| `OLLAMA_TIMEOUT` | `120` | Timeout (s) des appels LLM |
| `CHUNK_SIZE` | `500` | Tokens cibles par chunk |
| `CHUNK_OVERLAP` | `50` | Chevauchement entre chunks |
| `TOP_K_CHUNKS` | `5` | Chunks remontés par requête sémantique |
| `QUESTIONS_FOR_ADAPTATION` | `5` | Taille de la fenêtre pour adapter la difficulté |

## Gouvernance

Chaque événement (upload, génération, réponse, suppression) est tracé dans `data/logs/audit-YYYY-MM-DD.jsonl` au format JSON Lines. Les questions stockent l'identifiant du chunk source utilisé, ce qui permet de vérifier qu'aucune réponse n'a été hallucinée hors corpus.

## Arborescence

```
quizz-cours-IA/
├── docker-compose.yml      Orchestration des 4 services
├── Makefile                Raccourcis (run, stop, test, ...)
├── .env / .env.example     Configuration
├── backend/                FastAPI (api/, services/, models/, tests/)
├── frontend/               Streamlit (app.py, pages/, components/)
├── data/                   Volumes persistants (uploads, chroma, logs, db)
├── corpus_exemple/         2 cours .md prêts à indexer
├── docs/                   API reference, architecture
└── scripts/                init_ollama.sh, seed_corpus.sh, run_tests.sh
```

## Pièges connus

- **Premier démarrage long** : le pull du modèle `mistral:7b` (~4 Go) peut prendre plusieurs minutes. Suivez avec `docker logs -f tuteur-quiz-ollama`.
- **PDF scannés** : PyMuPDF n'extrait pas l'image — l'OCR n'est pas inclus. Convertissez en `.md` ou `.txt` au préalable.
- **Latence LLM** : sur CPU sans GPU, comptez 10–60 s par question. Réduire avec `phi3:mini`.
- **Redémarrage propre** : `docker compose down` (sans `-v`) conserve les données. `make reset` les efface.

## Licences

Toutes les dépendances sont open-source :

- Ollama (MIT), FastAPI (MIT), Streamlit (Apache 2.0), ChromaDB (Apache 2.0), sentence-transformers (Apache 2.0), PyMuPDF (AGPL — usage éducatif).
- Modèle `mistral:7b` : licence Apache 2.0 (Mistral AI).

---

*Projet Capstone — Module 11 — AI Agent Lab*
