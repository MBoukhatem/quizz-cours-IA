# Architecture — quizz-cours-IA

Ce document décrit l'architecture technique de l'application au travers de
plusieurs diagrammes complémentaires : cas d'utilisation, composants logiques,
flux RAG, séquence d'exécution et déploiement conteneurisé.

---

## 1. Diagramme de cas d'utilisation

```mermaid
%%{init: {"flowchart": {"htmlLabels": false}} }%%
flowchart LR
    subgraph Acteurs
        ENS[Enseignant]
        ETU[Etudiant]
    end

    subgraph Systeme[quizz-cours-IA]
        UC1((Importer un document))
        UC2((Generer un quiz))
        UC3((Poser une question RAG))
        UC4((Changer de modele LLM))
        UC5((Reinitialiser le store))
    end

    ENS --> UC1
    ENS --> UC2
    ENS --> UC4
    ENS --> UC5
    ETU --> UC1
    ETU --> UC2
    ETU --> UC3
```

**Acteurs et besoins** :

- **Enseignant** : prépare des quiz d'évaluation à partir de ses supports.
- **Étudiant** : s'auto-évalue et pose des questions ciblées sur ses cours.

---

## 2. Diagramme de composants

```mermaid
flowchart TB
    subgraph Client[Couche client]
        UI[Frontend React + Vite]
    end

    subgraph API[Couche API]
        FAPI[FastAPI - app/api.py]
        MEM[ConversationMemory]
    end

    subgraph Orchestration[Couche orchestration - LangGraph]
        ROUTER[Router node]
        RAG[RAG agent node]
        TOOLS[Tools agent node]
        FIN[Finalizer node]
    end

    subgraph Tools[Outils]
        WS[web_search - DuckDuckGo]
        QG[quiz_generator]
    end

    subgraph Donnees[Couche donnees]
        CHUNK[Chunker + Loader]
        EMB[Embedder sentence-transformers]
        VS[VectorStore ChromaDB]
    end

    subgraph LLM[Couche LLM locale]
        OLL[Ollama server]
        MOD[Modele llama3.2:3b]
    end

    subgraph Securite[Gouvernance]
        PG[prompt_guard]
    end

    UI -->|HTTP REST| FAPI
    FAPI --> PG
    PG --> ROUTER
    FAPI --> MEM
    FAPI --> CHUNK
    CHUNK --> EMB
    EMB --> VS

    ROUTER -->|route=rag| RAG
    ROUTER -->|route=tools| TOOLS
    RAG --> VS
    RAG --> QG
    TOOLS --> WS
    TOOLS --> QG
    RAG --> FIN
    TOOLS --> FIN
    FIN --> FAPI

    ROUTER -.->|chat| OLL
    RAG -.->|chat| OLL
    TOOLS -.->|chat| OLL
    QG -.->|chat| OLL
    OLL --> MOD
```

**Lecture du diagramme** : les flèches pleines représentent les flux
fonctionnels, les pointillés représentent les appels LLM (transverses).
Tous les nœuds d'orchestration peuvent appeler Ollama via la même interface
`OllamaClient.chat()`.

---

## 3. Diagramme de séquence — génération d'un quiz

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant API as FastAPI
    participant Guard as prompt_guard
    participant Graph as LangGraph
    participant Router as Router node
    participant RAG as RAG node
    participant Store as ChromaDB
    participant QG as quiz_generator
    participant Ollama
    participant Mem as Memory

    User->>UI: clique "Generer le quiz (5 questions)"
    UI->>API: POST /api/query {query}
    API->>Guard: sanitize_user_input(query)
    Guard-->>API: query nettoyee
    API->>Graph: invoke(initial_state)
    Graph->>Router: route_query(query)
    Router->>Ollama: chat (json mode)
    Ollama-->>Router: {"route": "rag"}
    Router-->>Graph: state.route = "rag"
    Graph->>RAG: rag_node(state)
    RAG->>Store: query(query, k=4)
    Store-->>RAG: 4 chunks pertinents
    RAG->>QG: generate_quiz(topic, context, n=5)
    QG->>Ollama: chat (json mode, schema)
    Ollama-->>QG: JSON quiz
    QG-->>RAG: Quiz validee (pydantic)
    RAG-->>Graph: state.quiz = {...}
    Graph->>Graph: finalizer(state)
    Graph-->>API: state final
    API->>Mem: add(user, assistant)
    API-->>UI: QueryResponse {thoughts, quiz}
    UI-->>User: affiche le quiz structure
```

---

## 4. Diagramme de flux RAG

```mermaid
flowchart LR
    DOC[Document utilisateur PDF/DOCX/TXT/MD]
    LOAD[Loader: pypdf / python-docx / plaintext]
    SPLIT[Chunker: split par paragraphe + overlap]
    EMB[Embedder: all-MiniLM-L6-v2 - 384 dims]
    UPS[Upsert dans ChromaDB]

    DOC --> LOAD --> SPLIT --> EMB --> UPS

    Q[Requete utilisateur]
    QEMB[Embedding requete]
    SEARCH[Recherche cosine top-k=4]
    CTX[Contexte enrichi avec citations]
    LLM[Ollama llama3.2:3b]
    OUT[Reponse / Quiz JSON]

    Q --> QEMB --> SEARCH
    UPS -.->|index| SEARCH
    SEARCH --> CTX --> LLM --> OUT
```

**Détails techniques** :

- Taille de chunk par défaut : ~800 caractères avec overlap de 100
- Distance : cosine, normalisée en score `1 - distance`
- Métadonnées indexées : `source` (nom fichier) et `page` (numéro)
- Top-k=4 pour équilibrer rappel et budget de tokens

---

## 5. Diagramme de déploiement (conteneurs Docker)

```mermaid
flowchart TB
    subgraph Host[Machine hote]
        direction TB

        subgraph DockerNet[Reseau Docker default]
            direction LR

            subgraph C1[Conteneur: chromadb]
                CHR[ChromaDB 0.5.20 :8000]
            end

            subgraph C2[Conteneur: ollama]
                OL[Ollama server :11434]
            end

            subgraph C3[Conteneur: ollama-init]
                INIT[ollama pull llama3.2:3b]
            end

            subgraph C4[Conteneur: api]
                FA[FastAPI uvicorn :8000]
            end

            subgraph C5[Conteneur: web]
                NG[nginx + bundle React :5173]
            end
        end

        subgraph Vols[Volumes nommes]
            V1[(chroma_data)]
            V2[(ollama_models)]
            V3[(hf_cache)]
        end

        BROWSER[Navigateur utilisateur]
    end

    BROWSER -->|http://localhost:5173| NG
    NG -->|proxy /api| FA
    FA -->|http chromadb:8000| CHR
    FA -->|http ollama:11434| OL
    INIT -->|http ollama:11434| OL

    CHR --- V1
    OL --- V2
    FA --- V3
```

**Ports exposés sur l'hôte** :

| Service | Port hôte | Port conteneur | Usage |
|---|---|---|---|
| web | 5173 | 5173 | UI utilisateur |
| api | 8000 | 8000 | API REST + Swagger |
| ollama | 11434 | 11434 | Debug / `ollama pull` manuel |
| chromadb | — | 8000 | Non exposé, accès interne uniquement |

**Volumes persistants** :

- `chroma_data` : index vectoriel ChromaDB (re-créé à chaque `/api/reset`)
- `ollama_models` : modèles téléchargés (~2 Go pour llama3.2:3b)
- `hf_cache` : modèles d'embeddings HuggingFace (~90 Mo)

---

## 6. Cycle de vie complet d'une requête

1. L'utilisateur saisit une requête dans l'UI (ou le CLI).
2. Le frontend `POST /api/query` ; FastAPI passe la requête par
   `prompt_guard.sanitize_user_input()` (réécriture des motifs d'injection).
3. Le graphe LangGraph est invoqué avec un `initial_state` contenant la
   requête nettoyée et l'historique des N derniers tours.
4. **Router** : analyse heuristique (tokens) puis LLM en tie-breaker si
   ambigu. Écrit `state["route"]` ∈ {`"rag"`, `"tools"`}.
5. **RAG path** (`route == "rag"`) :
   - `VectorStore.query()` retourne les top-k chunks (k=4) avec leurs
     métadonnées de source.
   - Si la requête contient un mot-clé quiz → délégation à `quiz_generator`
     avec un contexte ancré dans les chunks.
   - Sinon → réponse textuelle avec citations `[Source: fichier, page: N]`.
6. **Tools path** (`route == "tools"`) :
   - Décision LLM : faut-il une recherche web ? (heuristique +
     `use_web` JSON).
   - Si oui → `web_search` DuckDuckGo, sinon utilisation des connaissances
     internes du modèle.
   - Délégation éventuelle à `quiz_generator` avec les snippets web.
7. **Finalizer** : formate la sortie (texte ou quiz structuré) et accumule
   les `thoughts` (Routeur, RAG/Outils, Final).
8. La mémoire conversationnelle (`ConversationMemory`) enregistre l'échange
   et garantit la fenêtre des `MAX_HISTORY_TURNS` derniers tours.
9. La réponse JSON `QueryResponse` est retournée à l'UI qui affiche le quiz
   structuré et les étapes de raisonnement.

---

## 7. Décisions d'architecture (ADR résumés)

| Décision | Alternative écartée | Justification |
|---|---|---|
| LangGraph plutôt que chaîne LangChain | LangChain `SequentialChain` | Routage conditionnel natif, état typé, traçabilité par nœud |
| Ollama plutôt que llama.cpp embarqué | `llama-cpp-python` | Service séparé → couplage faible, modèles partagés entre conteneurs |
| ChromaDB plutôt que Qdrant | Qdrant, Weaviate | API simple, fallback PersistentClient sans serveur |
| sentence-transformers local plutôt que API embeddings | OpenAI / Cohere | Zéro dépendance cloud, conforme à l'exigence locale |
| pydantic v2 pour les sorties LLM | Validation manuelle JSON | Garanties de schéma, messages d'erreur exploitables pour retry |
| FastAPI plutôt que Flask | Flask | Validation automatique, OpenAPI gratuit, async-ready |

---

## 8. Limites connues et évolutions

**Limites actuelles** :

- Pipeline mono-document : chaque import remplace le corpus (par design)
- Pas de streaming des réponses (latence perçue plus élevée sur petits modèles)
- Pas de cache de requêtes : deux générations identiques re-paient le LLM

**Évolutions identifiées** :

- Multi-corpus avec sélection au moment de la requête
- Streaming SSE vers le frontend pour afficher les tokens à la volée
- Cache LRU des couples (query, top-k chunks) pour les démos
- Export PDF/Markdown du quiz généré
