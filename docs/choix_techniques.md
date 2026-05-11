# Choix techniques — justifications

Cette note explique pourquoi chaque brique a été retenue, en cohérence avec la contrainte **100 % gratuit, 100 % local**.

| Brique | Choix | Pourquoi | Alternatives écartées |
|--------|-------|----------|-----------------------|
| LLM | **Ollama + Mistral 7B Q4** | Gratuit, tourne sur 8 Go RAM, qualité FR correcte, API HTTP simple, image Docker officielle | OpenAI / Anthropic (payants), llama.cpp brut (plus de plomberie), vLLM (GPU requis) |
| Backend | **FastAPI 0.115** | Async natif, OpenAPI auto, Pydantic v2, écosystème mature, démarrage rapide | Flask (sync), Django (lourd), Express (autre langage) |
| Frontend | **Streamlit 1.40** | Multi-pages natif, widgets `file_uploader`, `plotly`, déploiement trivial, 100 % Python | Gradio (moins de contrôle layout), React (over-engineering) |
| Vector DB | **ChromaDB 0.5** | Image Docker, persistant, fonction d'embedding intégrée, cosine similarity, API simple | Pinecone / Weaviate Cloud (payants), FAISS brut (pas de persistance HTTP), Qdrant (acceptable mais image plus lourde) |
| Embeddings | **sentence-transformers `all-MiniLM-L6-v2`** | 80 Mo, 384 dimensions, multilingue acceptable, rapide CPU | OpenAI embeddings (payant), modèles plus gros (latence) |
| Extraction PDF | **PyMuPDF (fitz)** | Rapide, extraction page-à-page, métadonnées de page, AGPL OK en éducatif | pdfplumber (plus lent), pdfminer.six (parsing moins propre), Tesseract OCR (hors périmètre) |
| Persistance sessions | **SQLite** | Mono-fichier, zéro config, suffisant mono-utilisateur, lecture/écriture rapides | PostgreSQL (sur-dimensionné), Redis (volatile par défaut) |
| Conteneurs | **Docker Compose** | Imposé par la grille, multi-services, volumes simples | Kubernetes (over-engineering) |
| Tests | **pytest 8 + httpx TestClient** | Standard Python, fixtures, async natif | unittest (verbeux), nose (déprécié) |

## Points d'attention spécifiques

### Format JSON dans les prompts

Les modèles 7B en local hallucinent fréquemment la structure JSON. Deux protections :

1. `options.format=json` côté Ollama force une sortie JSON valide quand le modèle le supporte.
2. Le parser `parse_json_response` extrait le premier objet `{ ... }` trouvé, supprime les fences `\`\`\`json`, et `_validate_payload` rejette toute structure non conforme (4 choix exactement, index 0–3). Une 2e tentative est faite en cas d'échec avant de renvoyer 502.

### Embeddings côté backend (et non côté Chroma serveur)

ChromaDB serveur ne fait pas d'embeddings tout seul : il faut soit envoyer les vecteurs, soit configurer une fonction côté client. On a choisi le **HttpClient** avec `SentenceTransformerEmbeddingFunction` calculée dans le backend → image plus lourde, mais aucune dépendance HTTP supplémentaire à l'extérieur.

### Anti-répétition

Le tableau `questions(chunk_id)` est consulté pour exclure les 20 derniers chunks de la session lors du `vectorstore.query`. Cela évite la fatigue cognitive d'un même passage vu 3 fois de suite, sans complexifier la sélection (on garde une recherche sémantique standard).

### Adaptation de la difficulté

On lit les 5 dernières réponses (fenêtre glissante), on calcule le taux, et on ajuste de ±1 cran si `<60 %` ou `≥90 %`. Pas de bandit / RL : la spec n'en demande pas et 5 questions suffisent à observer un signal exploitable.

### Pas d'OCR

Les PDF scannés sont signalés à l'utilisateur via une 422 explicite. L'OCR (Tesseract) ajouterait ~250 Mo à l'image et des problèmes de qualité — c'est explicitement listé comme **bonus** dans la spec, pas livré dans cette première version.
