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

## Démarrage rapide (Docker)

```bash
cp .env.example .env
# Editez .env et renseignez OPENROUTER_API_KEY
docker compose up --build
```

Dans le CLI interactif qui s'ouvre :

```
> /ingest data/samples/lecture_ml.md
> Génère un quiz de 5 questions sur le machine learning supervisé
```

---

## Démarrage local (sans Docker)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Editez .env et renseignez OPENROUTER_API_KEY
python -m app.main
```

ChromaDB sera utilisé en mode persistant local (`./.chroma`) si le conteneur n'est pas disponible.

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
