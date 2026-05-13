# quizz-cours-IA

Générateur de quiz pédagogiques multi-agents à partir de vos documents de cours.
Ingérez un PDF, un DOCX ou un fichier Markdown, posez une question ou demandez un quiz,
et obtenez des questions ancrées dans votre support avec citations de sources.

---

## Architecture

Voir [docs/architecture.md](docs/architecture.md) pour le diagramme complet.

```
Utilisateur
    |
    v
[CLI Rich] --> [Routeur] --> [RAG agent]   --> [Finalizer] --> Réponse
                       \--> [Tools agent] /
                              |
                          web_search / quiz_generator
```

Le routeur analyse la requête et décide :
- **rag** : la question porte sur les documents ingérés (cours, supports).
- **tools** : la question est générale ou porte sur l'actualité (recherche web + quiz).

---

## Stack

| Composant | Technologie |
|---|---|
| Orchestration | LangGraph |
| LLM | OpenRouter (modèles gratuits) |
| Modèle principal | `meta-llama/llama-3.3-70b-instruct:free` |
| Modèle fallback | `google/gemini-2.0-flash-exp:free` |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local) |
| Vector DB | ChromaDB |
| CLI | Rich |
| Recherche web | duckduckgo-search |
| Tests | pytest |
| Validation | pydantic v2 |

---

## Démarrage rapide (Docker — UI web + API)

```bash
cp .env.example .env
# Editez .env et renseignez OPENROUTER_API_KEY
docker compose up --build
```

- UI React : http://localhost:5173
- API FastAPI : http://localhost:8000 (docs auto : http://localhost:8000/docs)

Depuis l'UI :
1. cliquez sur **Importer un document** pour ingérer un PDF/DOCX/TXT/MD
2. tapez votre question ou demandez un quiz dans la zone de saisie

### CLI Rich d'origine (optionnel)

Le REPL terminal est toujours disponible via un profile Docker :

```bash
docker compose --profile cli run --rm cli
```

---

## Démarrage local (sans Docker)

```bash
python -m venv .venv
source .venv/bin/activate         # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Editez .env et renseignez OPENROUTER_API_KEY

# Option A — UI web + API
uvicorn app.api:app --reload --port 8000
# dans un autre terminal :
cd web && npm install && npm run dev
# UI : http://localhost:5173

# Option B — CLI Rich
python -m app.main
```

ChromaDB tombe automatiquement en mode persistant local (`./.chroma`) si le
conteneur n'est pas disponible — pas besoin de serveur séparé en local.

> **Python 3.11 ou 3.12 recommandé.** `sentence-transformers` et `chromadb`
> n'ont pas encore de wheels pour 3.14.

---

## API REST

| Méthode | Endpoint | Description |
|---|---|---|
| GET  | `/api/health` | Liveness check |
| GET  | `/api/status` | Nombre de chunks, taille de mémoire, modèle |
| POST | `/api/query` | `{ "query": "…" }` → `{ thoughts, final_answer, quiz? }` |
| POST | `/api/ingest` | multipart `file` (PDF/DOCX/TXT/MD) → `{ chunks }` |
| POST | `/api/reset` | Vide le store et la mémoire |

Docs interactives Swagger UI : http://localhost:8000/docs

---

## Commandes CLI

| Commande | Description |
|---|---|
| `/ingest <chemin>` | Ingère un document (PDF, DOCX, TXT, MD) dans le store |
| `/reset` | Vide la mémoire conversationnelle et le store vectoriel |
| `/status` | Affiche le nombre de chunks, la taille de la mémoire et le modèle |
| `/help` | Affiche la liste des commandes |
| `/quit` ou `/exit` | Quitter le REPL |
| `<texte>` | Toute autre saisie est traitée comme une requête |

---

## Tests

```bash
pytest
```

Pour lancer uniquement les tests sans clé API :

```bash
pytest tests/test_security.py tests/test_tools.py
```

---

## Sécurité

Voir [docs/security.md](docs/security.md) pour la matrice des risques et les parades
contre les attaques par injection de prompt.
