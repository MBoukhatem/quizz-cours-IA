# 🎓 Tuteur Quiz Adaptatif — Spécification Complète du Projet

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Objectifs pédagogiques et fonctionnels](#2-objectifs-pédagogiques-et-fonctionnels)
3. [Architecture globale](#3-architecture-globale)
4. [Arborescence du projet](#4-arborescence-du-projet)
5. [Choix techniques et versions](#5-choix-techniques-et-versions)
6. [Description des services](#6-description-des-services)
7. [Flux de données et interactions](#7-flux-de-données-et-interactions)
8. [Modèle RAG](#8-modèle-rag)
9. [Planification et orchestration](#9-planification-et-orchestration)
10. [Gouvernance et observabilité](#10-gouvernance-et-observabilité)
11. [Étapes de réalisation (checklist)](#11-étapes-de-réalisation-checklist)
12. [Diagrammes requis](#12-diagrammes-requis)
13. [Jeux de données et corpus](#13-jeux-de-données-et-corpus)
14. [Tests et validation](#14-tests-et-validation)
15. [Livrables attendus](#15-livrables-attendus)
16. [FAQ et pièges à éviter](#16-faq-et-pièges-à-éviter)

---

## 1. Présentation du projet

Le **Tuteur Quiz Adaptatif** est un agent IA local qui aide un étudiant à réviser un cours en générant des quiz à partir de ses propres supports de cours (PDF, Markdown, fichiers texte). L'agent utilise un pipeline RAG (Retrieval-Augmented Generation) pour extraire les passages pertinents du corpus, puis génère des questions à choix multiples (QCM), corrige les réponses de l'étudiant, et fournit des explications détaillées en citant les sources du cours.

Le projet est **100% gratuit** et fonctionne **entièrement en local** sans aucune dépendance à une API cloud payante.

### Cas d'usage concret

Un étudiant en droit, informatique ou économie uploade ses supports de cours (PDF de 50-200 pages). Il lance une session de révision. L'agent :

1. Indexe le contenu du cours dans une base vectorielle
2. Sélectionne un thème ou passage pertinent
3. Génère une question QCM (4 choix, 1 bonne réponse)
4. L'étudiant répond
5. L'agent corrige, explique pourquoi c'est juste ou faux, cite le passage du cours
6. Adapte la difficulté selon le score cumulé
7. Affiche un tableau de bord de progression

---

## 2. Objectifs pédagogiques et fonctionnels

### Objectifs fonctionnels

- Upload de fichiers PDF/Markdown/TXT comme corpus de cours
- Indexation automatique du corpus dans une base vectorielle
- Génération de QCM à partir du contenu indexé
- Correction automatique avec explication et citation des sources
- Adaptation de la difficulté (facile → moyen → difficile) selon le score
- Tableau de bord de progression (score par thème, historique)
- Logs de chaque interaction pour traçabilité

### Objectifs techniques (alignés sur la grille d'évaluation)

- Architecture dockerisée complète (docker-compose unique)
- LLM local via Ollama (aucune API cloud)
- RAG fonctionnel avec corpus local
- Planificateur de difficulté
- Gouvernance : logs, audit trail
- Interface utilisateur locale
- Documentation complète

---

## 3. Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐   ┌─────────────┐ │
│  │   Frontend    │    │   Backend    │   │   Ollama     │ │
│  │  (Streamlit)  │◄──►│  (FastAPI)   │──►│  (LLM local) │ │
│  │   port 8501   │    │  port 8000   │   │  port 11434  │ │
│  └──────────────┘    └──────┬───────┘   └─────────────┘ │
│                             │                            │
│                      ┌──────▼───────┐                    │
│                      │  ChromaDB    │                    │
│                      │ (Vector DB)  │                    │
│                      │  port 8100   │                    │
│                      └──────────────┘                    │
│                                                          │
│  Volumes : /data/uploads  /data/chroma  /data/logs       │
└─────────────────────────────────────────────────────────┘
```

### Composants

| Service | Rôle | Port |
|---------|------|------|
| **Frontend (Streamlit)** | Interface utilisateur : upload, quiz, dashboard | 8501 |
| **Backend (FastAPI)** | API REST : orchestration, RAG, génération quiz | 8000 |
| **ChromaDB** | Base de données vectorielle pour le corpus indexé | 8100 |
| **Ollama** | Serveur LLM local (modèle mistral ou llama3) | 11434 |

---

## 4. Arborescence du projet

```
tuteur-quiz/
├── docker-compose.yml              # Orchestration de tous les services
├── Makefile                         # Commandes simplifiées (make run, make stop, make test)
├── .env                             # Variables d'environnement
├── .env.example                     # Template des variables d'environnement
├── README.md                        # Documentation principale
│
├── backend/
│   ├── Dockerfile                   # Image Docker du backend
│   ├── requirements.txt             # Dépendances Python du backend
│   ├── main.py                      # Point d'entrée FastAPI
│   ├── config.py                    # Configuration centralisée
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes_upload.py         # Endpoints upload de documents
│   │   ├── routes_quiz.py           # Endpoints génération et correction quiz
│   │   ├── routes_stats.py          # Endpoints statistiques et progression
│   │   └── routes_health.py         # Endpoint health check
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── document_processor.py    # Extraction texte PDF/MD/TXT, chunking
│   │   ├── vectorstore.py           # Interface ChromaDB (indexation, recherche)
│   │   ├── llm_client.py            # Client Ollama (appels au LLM)
│   │   ├── quiz_generator.py        # Génération de QCM via RAG + LLM
│   │   ├── quiz_evaluator.py        # Correction et feedback
│   │   ├── planner.py               # Planificateur de difficulté
│   │   └── logger.py                # Système de logs / audit
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py               # Modèles Pydantic (requêtes/réponses)
│   │   └── database.py              # Modèle SQLite pour sessions/scores
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_document_processor.py
│       ├── test_quiz_generator.py
│       ├── test_planner.py
│       └── test_api.py
│
├── frontend/
│   ├── Dockerfile                   # Image Docker du frontend
│   ├── requirements.txt             # Dépendances Python (streamlit)
│   ├── app.py                       # Application Streamlit principale
│   ├── pages/
│   │   ├── 01_upload.py             # Page upload de documents
│   │   ├── 02_quiz.py               # Page session de quiz
│   │   └── 03_dashboard.py          # Page tableau de bord
│   └── components/
│       ├── quiz_card.py             # Composant carte de question
│       └── progress_chart.py        # Composant graphique de progression
│
├── data/
│   ├── uploads/                     # Documents uploadés par l'étudiant
│   ├── chroma/                      # Données persistantes ChromaDB
│   ├── logs/                        # Fichiers de logs JSON
│   └── db/                          # Base SQLite (sessions, scores)
│
├── corpus_exemple/
│   ├── cours_python_bases.pdf       # Exemple de cours pour tester
│   ├── cours_python_bases.md        # Version Markdown du même cours
│   └── README.md                    # Explication du corpus d'exemple
│
├── docs/
│   ├── architecture.md              # Documentation architecture détaillée
│   ├── api_reference.md             # Référence complète de l'API
│   ├── diagrammes/
│   │   ├── use_case.puml            # Diagramme de cas d'utilisation (PlantUML)
│   │   ├── sequence_quiz.puml       # Diagramme de séquence quiz
│   │   ├── sequence_upload.puml     # Diagramme de séquence upload
│   │   ├── composants.puml          # Diagramme de composants
│   │   └── rag_flow.puml            # Diagramme du flux RAG
│   └── choix_techniques.md          # Justification des choix techniques
│
└── scripts/
    ├── init_ollama.sh               # Script pour pull le modèle Ollama au premier lancement
    ├── seed_corpus.sh               # Script pour indexer le corpus d'exemple
    └── run_tests.sh                 # Script pour lancer les tests
```

---

## 5. Choix techniques et versions

### Stack complète

| Composant | Technologie | Version | Justification |
|-----------|------------|---------|---------------|
| **LLM** | Ollama + Mistral 7B | Ollama ≥ 0.3.x, Mistral 7B Q4 | Gratuit, tourne sur 8 Go RAM, bon en français |
| **Backend** | FastAPI | ≥ 0.115.x | Async, auto-doc OpenAPI, léger |
| **Frontend** | Streamlit | ≥ 1.38.x | Rapide à coder, widgets interactifs, Python pur |
| **Vector DB** | ChromaDB | ≥ 0.5.x | Gratuit, léger, API Python simple, persistance fichier |
| **Embedding** | sentence-transformers (all-MiniLM-L6-v2) | ≥ 3.0.x | Gratuit, léger (80 Mo), multilingue acceptable |
| **Extraction PDF** | PyMuPDF (fitz) | ≥ 1.24.x | Rapide, gratuit, extraction texte fiable |
| **Base sessions** | SQLite | 3.x (intégré Python) | Zéro config, fichier unique, suffisant pour le cas |
| **Conteneurs** | Docker + Docker Compose | Docker ≥ 24.x, Compose ≥ 2.20.x | Obligation du cahier des charges |
| **Python** | Python | 3.11 | Stable, compatible toutes les libs |
| **Tests** | pytest | ≥ 8.x | Standard Python |
| **HTTP client** | httpx | ≥ 0.27.x | Async, utilisé pour appeler Ollama |

### Modèles Ollama recommandés

| Modèle | Taille | RAM minimum | Qualité FR | Recommandation |
|--------|--------|-------------|------------|----------------|
| **mistral:7b** | ~4 Go | 8 Go | Très bonne | Premier choix |
| **llama3:8b** | ~4.7 Go | 8 Go | Bonne | Alternative |
| **gemma2:9b** | ~5.5 Go | 10 Go | Bonne | Si plus de RAM dispo |
| **phi3:mini** | ~2.3 Go | 4 Go | Moyenne | Machine faible |

Le modèle est configurable via la variable `OLLAMA_MODEL` dans le fichier `.env`.

### Versions Docker des images de base

```yaml
# Images utilisées dans les Dockerfiles
python:3.11-slim          # Backend et Frontend
chromadb/chroma:0.5.23    # ChromaDB (image officielle)
ollama/ollama:latest      # Ollama (image officielle)
```

### Compatibilité testée

| OS | Version testée | Statut |
|----|---------------|--------|
| Ubuntu | 22.04 / 24.04 | Cible principale |
| macOS | Ventura+ (Apple Silicon & Intel) | Compatible |
| Windows | WSL2 + Docker Desktop | Compatible |

---

## 6. Description des services

### 6.1 Backend (FastAPI)

Le backend est le cœur de l'application. Il orchestre tous les flux.

#### Endpoints API

```
POST   /api/upload              # Upload d'un document (PDF, MD, TXT)
GET    /api/documents           # Liste des documents indexés
DELETE /api/documents/{id}      # Supprimer un document

POST   /api/quiz/generate       # Générer une question QCM
POST   /api/quiz/answer         # Soumettre une réponse et recevoir la correction
GET    /api/quiz/session/{id}   # Récupérer l'état d'une session de quiz

GET    /api/stats/summary       # Score global, taux de réussite
GET    /api/stats/history       # Historique des sessions
GET    /api/stats/topics        # Performance par thème/chapitre

GET    /api/health              # Health check (vérifie Ollama + ChromaDB)
```

#### Fichier `requirements.txt` du backend

```
fastapi==0.115.6
uvicorn==0.32.1
httpx==0.27.2
chromadb-client==0.5.23
sentence-transformers==3.3.1
PyMuPDF==1.24.14
python-multipart==0.0.18
pydantic==2.10.3
```

### 6.2 Frontend (Streamlit)

Trois pages principales :

**Page Upload** : drag & drop de fichiers, barre de progression de l'indexation, liste des documents indexés avec possibilité de supprimer.

**Page Quiz** : affichage d'une question avec 4 boutons de réponse, feedback immédiat (correct/incorrect + explication + citation du cours), bouton "Question suivante", indicateur de difficulté actuelle.

**Page Dashboard** : score global (%), graphique de progression par session, répartition des scores par thème, historique des dernières questions.

#### Fichier `requirements.txt` du frontend

```
streamlit==1.40.2
requests==2.32.3
plotly==5.24.1
```

### 6.3 ChromaDB

Stockage des embeddings du corpus de cours. Chaque chunk de document est stocké avec ses métadonnées (nom du fichier source, numéro de page, chapitre si détecté). Persistance via un volume Docker monté sur `/data/chroma`.

### 6.4 Ollama

Serveur LLM local. Le modèle est téléchargé au premier lancement via le script `init_ollama.sh`. L'API REST d'Ollama est appelée par le backend via httpx en mode async.

---

## 7. Flux de données et interactions

### Flux 1 : Upload et indexation d'un document

```
Étudiant → [Streamlit] upload PDF
              → [FastAPI] POST /api/upload
                  → [document_processor] extraction texte (PyMuPDF)
                  → [document_processor] découpage en chunks (500 tokens, overlap 50)
                  → [sentence-transformers] génération embeddings
                  → [ChromaDB] stockage chunks + embeddings + métadonnées
              ← réponse : {document_id, nb_chunks, statut}
          ← affichage confirmation
```

### Flux 2 : Génération d'un quiz

```
Étudiant → [Streamlit] clic "Nouvelle question"
              → [FastAPI] POST /api/quiz/generate {session_id, difficulty}
                  → [planner] déterminer le niveau de difficulté
                  → [vectorstore] recherche sémantique de chunks pertinents (top 3-5)
                  → [llm_client] prompt au LLM avec les chunks comme contexte
                      Prompt : "À partir du contexte suivant, génère un QCM de
                       niveau {difficulty} avec 4 choix et la bonne réponse..."
                  → [Ollama] génération de la question
                  → [logger] log de la question générée
              ← réponse : {question, choices[], correct_index, source_chunk}
          ← affichage de la question
```

### Flux 3 : Correction d'une réponse

```
Étudiant → [Streamlit] sélection d'une réponse
              → [FastAPI] POST /api/quiz/answer {question_id, selected_index}
                  → [quiz_evaluator] comparaison avec correct_index
                  → [llm_client] prompt pour générer l'explication
                      Prompt : "L'étudiant a répondu {X} à la question {Q}.
                       La bonne réponse est {Y}. Explique pourquoi en citant
                       le passage du cours : {source_chunk}"
                  → [Ollama] génération de l'explication
                  → [database] mise à jour du score session
                  → [planner] recalcul de la difficulté
                  → [logger] log de la réponse + résultat
              ← réponse : {is_correct, explanation, source_reference, new_difficulty}
          ← affichage feedback
```

---

## 8. Modèle RAG

### Pipeline RAG détaillé

```
Document PDF/MD/TXT
       │
       ▼
[Extraction texte]     ← PyMuPDF pour PDF, lecture directe pour MD/TXT
       │
       ▼
[Nettoyage]            ← Suppression headers/footers répétés, numéros de page
       │
       ▼
[Chunking]             ← Découpage en morceaux de ~500 tokens
       │                   avec overlap de 50 tokens
       │                   séparation par paragraphes quand possible
       ▼
[Embedding]            ← all-MiniLM-L6-v2 (sentence-transformers)
       │                   vecteurs de dimension 384
       ▼
[Stockage ChromaDB]    ← chunk_text + embedding + metadata
                           metadata = {source, page, chunk_index}
```

### Paramètres de chunking

```python
CHUNK_SIZE = 500        # tokens par chunk
CHUNK_OVERLAP = 50      # tokens de chevauchement entre chunks
MIN_CHUNK_SIZE = 100    # ignorer les chunks trop petits
```

### Recherche sémantique

Lors de la génération d'un quiz, le backend :

1. Sélectionne un thème aléatoire ou sous-représenté dans les questions précédentes
2. Effectue une recherche sémantique dans ChromaDB (top_k=5)
3. Filtre les chunks déjà utilisés récemment (éviter la répétition)
4. Envoie les 3 meilleurs chunks comme contexte au LLM

---

## 9. Planification et orchestration

### Planificateur de difficulté

Le planificateur (`planner.py`) ajuste la difficulté des questions selon les performances de l'étudiant.

```
Score récent (5 dernières questions) → Niveau suivant

90-100% correct  →  difficulté +1 (max: difficile)
60-89%  correct  →  même difficulté
0-59%   correct  →  difficulté -1 (min: facile)
```

Trois niveaux de difficulté intégrés dans le prompt :

| Niveau | Prompt instruction | Type de question |
|--------|-------------------|------------------|
| **Facile** | "Question de compréhension directe, réponse explicite dans le texte" | Fait, définition, date |
| **Moyen** | "Question nécessitant de relier deux concepts du cours" | Application, lien logique |
| **Difficile** | "Question d'analyse, l'étudiant doit inférer à partir du cours" | Analyse, cas pratique |

### Orchestration de session

```python
class SessionPlanner:
    def __init__(self, session_id):
        self.session_id = session_id
        self.difficulty = "facile"       # Démarre toujours facile
        self.scores = []                 # Historique des scores
        self.used_chunks = set()         # Chunks déjà utilisés (anti-répétition)
        self.topic_coverage = {}         # Couverture par source/chapitre

    def next_difficulty(self) -> str:
        """Calcule le prochain niveau de difficulté."""
        ...

    def select_topic(self) -> str:
        """Sélectionne le thème le moins couvert."""
        ...
```

---

## 10. Gouvernance et observabilité

### Logs (audit trail)

Chaque interaction est loguée dans un fichier JSON dans `/data/logs/`.

```json
{
  "timestamp": "2025-01-15T14:32:00Z",
  "session_id": "abc123",
  "event_type": "quiz_answer",
  "data": {
    "question_id": "q_001",
    "question_text": "Quelle est la complexité de tri par insertion ?",
    "user_answer": 2,
    "correct_answer": 1,
    "is_correct": false,
    "difficulty": "moyen",
    "source_document": "cours_algo.pdf",
    "source_page": 12,
    "llm_model": "mistral:7b",
    "response_time_ms": 2340
  }
}
```

### Métriques exposées

Le endpoint `GET /api/stats/summary` retourne :

```json
{
  "total_questions": 47,
  "correct_answers": 31,
  "success_rate": 65.9,
  "current_difficulty": "moyen",
  "sessions_count": 5,
  "documents_indexed": 3,
  "total_chunks": 156
}
```

### Traçabilité

Chaque question générée conserve la référence au chunk source utilisé, permettant de vérifier que le LLM n'hallucine pas. L'explication fournie à l'étudiant inclut systématiquement la citation du passage du cours.

---

## 11. Étapes de réalisation (checklist)

Ce plan de travail est conçu pour qu'un assistant IA (Claude) puisse suivre l'avancement et savoir exactement ce qui reste à faire. Chaque étape produit un livrable vérifiable.

### Phase 1 — Infrastructure et squelette (Jour 1-2)

- [ ] **1.1** Créer l'arborescence complète du projet (tous les dossiers et fichiers `__init__.py`)
- [ ] **1.2** Rédiger le fichier `docker-compose.yml` avec les 4 services (backend, frontend, chromadb, ollama)
- [ ] **1.3** Rédiger le `Dockerfile` du backend (Python 3.11-slim, installation dépendances)
- [ ] **1.4** Rédiger le `Dockerfile` du frontend (Python 3.11-slim, Streamlit)
- [ ] **1.5** Créer les fichiers `.env.example` et `.env` avec toutes les variables
- [ ] **1.6** Créer le `Makefile` (make run, make stop, make test, make logs)
- [ ] **1.7** Écrire le script `init_ollama.sh` (pull du modèle au premier lancement)
- [ ] **1.8** Vérifier que `docker-compose up` lance tous les services sans erreur
- [ ] **1.9** Implémenter le endpoint `GET /api/health` (vérifie Ollama + ChromaDB)

**Livrable** : `docker-compose up` fonctionne, le health check est vert.

### Phase 2 — Extraction et indexation de documents (Jour 2-3)

- [ ] **2.1** Implémenter `document_processor.py` : extraction texte PDF (PyMuPDF)
- [ ] **2.2** Implémenter `document_processor.py` : extraction texte MD et TXT
- [ ] **2.3** Implémenter le chunking (découpage en morceaux avec overlap)
- [ ] **2.4** Implémenter `vectorstore.py` : connexion à ChromaDB
- [ ] **2.5** Implémenter `vectorstore.py` : indexation des chunks avec embeddings
- [ ] **2.6** Implémenter `vectorstore.py` : recherche sémantique (query → top_k chunks)
- [ ] **2.7** Implémenter `routes_upload.py` : endpoint POST /api/upload
- [ ] **2.8** Implémenter `routes_upload.py` : endpoint GET /api/documents
- [ ] **2.9** Créer un corpus d'exemple (1-2 PDF de cours libres de droit)
- [ ] **2.10** Tester l'upload et l'indexation de bout en bout

**Livrable** : on peut uploader un PDF et chercher des passages par requête sémantique.

### Phase 3 — Client LLM et génération de quiz (Jour 3-4)

- [ ] **3.1** Implémenter `llm_client.py` : appel à l'API Ollama (POST /api/generate)
- [ ] **3.2** Implémenter `llm_client.py` : gestion des erreurs et timeouts
- [ ] **3.3** Rédiger les prompts de génération de QCM (3 niveaux de difficulté)
- [ ] **3.4** Implémenter `quiz_generator.py` : pipeline RAG → prompt → parsing réponse LLM
- [ ] **3.5** Implémenter le parsing de la réponse LLM en structure {question, choices, correct_index}
- [ ] **3.6** Implémenter `routes_quiz.py` : endpoint POST /api/quiz/generate
- [ ] **3.7** Tester la génération de quiz sur le corpus d'exemple

**Livrable** : l'API génère des QCM corrects à partir du corpus.

### Phase 4 — Correction et feedback (Jour 4-5)

- [ ] **4.1** Implémenter `quiz_evaluator.py` : correction de la réponse
- [ ] **4.2** Implémenter `quiz_evaluator.py` : génération d'explication via LLM
- [ ] **4.3** Implémenter `routes_quiz.py` : endpoint POST /api/quiz/answer
- [ ] **4.4** Implémenter `database.py` : modèle SQLite pour stocker sessions et scores
- [ ] **4.5** Implémenter la persistance des scores en base
- [ ] **4.6** Tester le flux complet : générer question → répondre → recevoir feedback

**Livrable** : le flux question-réponse-correction fonctionne de bout en bout via l'API.

### Phase 5 — Planificateur de difficulté (Jour 5)

- [ ] **5.1** Implémenter `planner.py` : calcul de la difficulté selon le score récent
- [ ] **5.2** Implémenter la sélection de thème (couverture équilibrée du corpus)
- [ ] **5.3** Implémenter l'anti-répétition (ne pas réutiliser les mêmes chunks)
- [ ] **5.4** Intégrer le planner dans le flux de génération de quiz
- [ ] **5.5** Tester l'adaptation de difficulté sur une session de 10+ questions

**Livrable** : la difficulté s'adapte automatiquement selon les performances.

### Phase 6 — Gouvernance et logs (Jour 5-6)

- [ ] **6.1** Implémenter `logger.py` : écriture de logs JSON dans /data/logs/
- [ ] **6.2** Logger chaque upload de document
- [ ] **6.3** Logger chaque question générée
- [ ] **6.4** Logger chaque réponse de l'étudiant (avec résultat)
- [ ] **6.5** Implémenter `routes_stats.py` : endpoints statistiques
- [ ] **6.6** Tester que les logs sont complets et exploitables

**Livrable** : chaque interaction est tracée dans des fichiers JSON.

### Phase 7 — Interface utilisateur Streamlit (Jour 6-8)

- [ ] **7.1** Implémenter `app.py` : structure multi-pages Streamlit
- [ ] **7.2** Implémenter `pages/01_upload.py` : upload de fichiers + liste documents
- [ ] **7.3** Implémenter `pages/02_quiz.py` : interface de quiz interactive
- [ ] **7.4** Implémenter `pages/02_quiz.py` : affichage du feedback et des sources
- [ ] **7.5** Implémenter `pages/03_dashboard.py` : score global et graphiques
- [ ] **7.6** Implémenter `components/quiz_card.py` : composant carte de question
- [ ] **7.7** Implémenter `components/progress_chart.py` : graphique Plotly de progression
- [ ] **7.8** Tester l'interface complète de bout en bout

**Livrable** : l'interface Streamlit permet d'utiliser toutes les fonctionnalités.

### Phase 8 — Tests et robustesse (Jour 8-9)

- [ ] **8.1** Écrire les tests unitaires pour `document_processor.py`
- [ ] **8.2** Écrire les tests unitaires pour `quiz_generator.py`
- [ ] **8.3** Écrire les tests unitaires pour `planner.py`
- [ ] **8.4** Écrire les tests d'intégration pour les endpoints API
- [ ] **8.5** Tester sur une deuxième machine (Ubuntu ou macOS ou WSL)
- [ ] **8.6** Corriger les bugs de compatibilité
- [ ] **8.7** Tester avec différents types de PDF (scannés, tableaux, longs)

**Livrable** : tests passent, le projet fonctionne sur 2 machines différentes.

### Phase 9 — Documentation et diagrammes (Jour 9-10)

- [ ] **9.1** Rédiger le README.md complet (installation, lancement, utilisation)
- [ ] **9.2** Rédiger la documentation API (`docs/api_reference.md`)
- [ ] **9.3** Créer le diagramme de cas d'utilisation (PlantUML)
- [ ] **9.4** Créer le diagramme de séquence — flux quiz
- [ ] **9.5** Créer le diagramme de séquence — flux upload
- [ ] **9.6** Créer le diagramme de composants
- [ ] **9.7** Créer le diagramme du flux RAG
- [ ] **9.8** Rédiger le rapport PDF du projet

**Livrable** : documentation complète, diagrammes UML, rapport PDF.

### Phase 10 — Démonstration (Jour 10)

- [ ] **10.1** Préparer un scénario de démonstration de bout en bout
- [ ] **10.2** Préparer les slides de présentation
- [ ] **10.3** Répéter la démonstration (docker-compose up → upload → quiz → dashboard)
- [ ] **10.4** Préparer des réponses aux questions prévisibles du jury
- [ ] **10.5** (Bonus) Enregistrer une vidéo de démonstration de 2-3 minutes

**Livrable** : démo fonctionnelle, slides, préparation jury.

---

## 12. Diagrammes requis

### Liste des diagrammes à produire

1. **Diagramme de cas d'utilisation (UML)** : acteur "Étudiant", cas : uploader un cours, lancer un quiz, consulter ses statistiques
2. **Diagramme de séquence — Upload** : Étudiant → Frontend → Backend → DocumentProcessor → ChromaDB
3. **Diagramme de séquence — Quiz** : Étudiant → Frontend → Backend → VectorStore → LLM → Évaluateur → Frontend
4. **Diagramme de composants** : les 4 services Docker et leurs interfaces
5. **Diagramme du flux RAG** : Document → Chunks → Embeddings → VectorDB → Retrieval → Prompt → LLM → Réponse
6. **Diagramme d'architecture Docker** : containers, ports, volumes, réseau

Outil recommandé : PlantUML (gratuit, texte → image, intégrable dans le rapport). Alternative : draw.io (export PNG/SVG).

---

## 13. Jeux de données et corpus

### Corpus d'exemple fourni avec le projet

Le projet doit inclure un corpus d'exemple pour que le jury puisse tester immédiatement sans fournir ses propres documents.

Sources gratuites et libres de droit recommandées :

| Source | Contenu | Format | Licence |
|--------|---------|--------|---------|
| OpenClassrooms (anciennes versions CC) | Cours Python, algo, web | PDF/HTML | Creative Commons |
| Cours universitaires publics | Supports de cours publiés par des enseignants | PDF | Domaine public |
| Wikibooks | Manuels collaboratifs | PDF export | CC-BY-SA |
| Notes de cours personnelles | Rédigées par l'étudiant lui-même | MD/TXT | Propre |

Recommandation : créer 2-3 fichiers Markdown de 10-20 pages simulant un cours structuré (chapitres, définitions, exemples). Cela garantit un corpus propre et contrôlé pour la démo.

---

## 14. Tests et validation

### Stratégie de tests

| Type | Outil | Cible |
|------|-------|-------|
| Tests unitaires | pytest | document_processor, planner, quiz_generator |
| Tests d'intégration | pytest + httpx | Endpoints API (upload, quiz, stats) |
| Test de bout en bout | Manuel | Scénario complet via l'interface Streamlit |
| Test de reproductibilité | Docker | Lancement sur 2 machines différentes |

### Critères de validation

- Un PDF de 50+ pages s'indexe en moins de 2 minutes
- La génération d'une question prend moins de 30 secondes (dépend du hardware)
- Le taux de questions cohérentes (pas d'hallucination évidente) est supérieur à 80%
- Les sources citées correspondent réellement au contenu du cours
- Le score de l'étudiant se persiste entre les sessions (SQLite + volume Docker)
- `docker-compose down && docker-compose up` ne perd pas les données

---

## 15. Livrables attendus

| Livrable | Format | Contenu |
|----------|--------|---------|
| **Dépôt GitHub** | Repo Git | Code complet + README + .env.example |
| **docker-compose.yml** | YAML | Tous les services, lance avec `docker-compose up` |
| **README.md** | Markdown | Installation, dépendances, exécution, variables .env, endpoints |
| **Rapport PDF** | PDF | Besoin, architecture, technique, tests, résultats, bilan |
| **Diagrammes** | PNG/SVG + sources PlantUML | UML, architecture, RAG flow, séquences |
| **Slides** | PDF/PPTX | Présentation pour le jury |
| **Démonstration** | Live | docker-compose up → scénario complet |
| **(Bonus) Vidéo** | MP4 | 2-3 minutes de démo enregistrée |

---

## 16. FAQ et pièges à éviter

**"Ollama est trop lent sur ma machine"**
Utiliser un modèle plus petit : `phi3:mini` (2.3 Go) au lieu de `mistral:7b`. Augmenter le timeout dans le backend. Le modèle est configurable via `.env`, donc le jury peut choisir selon son hardware.

**"ChromaDB ne persiste pas les données entre les redémarrages"**
Vérifier que le volume Docker est bien monté : `./data/chroma:/chroma/chroma` dans le docker-compose. ChromaDB doit être lancé avec `--path /chroma/chroma`.

**"Le LLM génère des questions incohérentes"**
Améliorer le prompt : être très directif sur le format de sortie attendu (JSON strict), donner des exemples dans le prompt (few-shot), filtrer les chunks trop courts ou trop génériques.

**"L'extraction PDF donne du texte illisible"**
Certains PDF sont des images scannées. PyMuPDF ne fait pas d'OCR. Pour ces cas, recommander à l'utilisateur de fournir un fichier Markdown ou TXT. L'OCR (Tesseract) est un bonus, pas une obligation.

**"Docker Compose ne trouve pas Ollama"**
S'assurer que les services sont sur le même réseau Docker. Utiliser le nom du service (`ollama`) comme hostname, pas `localhost`. Exemple : `OLLAMA_BASE_URL=http://ollama:11434`.

**"Le projet est-il vraiment gratuit ?"**
Oui. Toutes les technologies utilisées sont open-source et gratuites : Ollama (MIT), FastAPI (MIT), Streamlit (Apache 2.0), ChromaDB (Apache 2.0), sentence-transformers (Apache 2.0), PyMuPDF (AGPL, usage éducatif OK). Aucune API cloud payante.

---

## Annexe : Variables d'environnement (.env)

```env
# Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=mistral:7b
OLLAMA_TIMEOUT=120

# ChromaDB
CHROMA_HOST=chromadb
CHROMA_PORT=8100

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
LOG_LEVEL=INFO
LOG_DIR=/data/logs

# Embedding
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Chunking
CHUNK_SIZE=500
CHUNK_OVERLAP=50

# Quiz
DEFAULT_DIFFICULTY=facile
QUESTIONS_FOR_ADAPTATION=5
TOP_K_CHUNKS=5

# SQLite
DATABASE_PATH=/data/db/sessions.db
```

---

## Annexe : docker-compose.yml (structure attendue)

```yaml
version: "3.8"

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        limits:
          memory: 8G

  chromadb:
    image: chromadb/chroma:0.5.23
    ports:
      - "8100:8000"
    volumes:
      - ./data/chroma:/chroma/chroma
    environment:
      - ANONYMIZED_TELEMETRY=FALSE

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/data
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8000
    depends_on:
      - ollama
      - chromadb

  frontend:
    build: ./frontend
    ports:
      - "8501:8501"
    environment:
      - BACKEND_URL=http://backend:8000
    depends_on:
      - backend

volumes:
  ollama_data:
```

---

*Document généré pour le projet Capstone — Module 11 — AI Agent Lab*
*Dernière mise à jour : Mai 2026*
