# Cahier des charges — quizz-cours-IA

**Projet de fin de cours — Module 11 (AI Agent Lab)**
**Auteur :** Boukhatem
**Date :** mai 2026
**Domaine :** Éducation / E-learning

---

## 1. Contexte et problématique

### 1.1 Constat métier

Dans l'enseignement supérieur, la **création de quiz pédagogiques** à partir
de supports de cours (PDF, polycopiés, slides) est une tâche chronophage pour
les enseignants. Une étude interne au lab indique qu'un enseignant passe
**en moyenne 30 à 45 minutes** pour préparer un quiz de 10 questions à
partir d'un cours de 20 pages, en incluant la formulation, les options de
réponse et la justification de chaque bonne réponse.

Côté étudiant, l'**auto-évaluation** est limitée par le manque de quiz
diversifiés sur un même support : les questions des annales se répètent,
et les outils en ligne (Kahoot, Quizlet) ne permettent pas de générer
des quiz à partir de documents arbitraires.

### 1.2 Public cible

| Persona | Besoin |
|---|---|
| **Enseignant** | Générer rapidement des quiz d'évaluation à partir de ses propres supports |
| **Étudiant** | S'auto-évaluer sur un cours en générant des quiz variés à la demande |
| **Responsable formation** | Industrialiser la production de QCM pour des plateformes LMS |

### 1.3 Pourquoi un agent IA ?

Trois exigences techniques motivent l'approche par agents :

1. **Ancrage dans le document** (RAG) : les questions doivent refléter
   *le contenu réel* du support, pas les connaissances générales du LLM.
2. **Décisions contextuelles** : selon la requête (question ouverte / quiz /
   recherche externe), le pipeline doit emprunter des chemins différents.
3. **Sortie structurée garantie** : le quiz est consommé par l'UI sous forme
   d'objet JSON typé — pas de génération « texte libre ».

---

## 2. Objectifs

### 2.1 Objectif principal

Fournir une **application locale dockerisée** capable de générer des quiz
pédagogiques structurés et sourcés, à partir de documents importés par
l'utilisateur, **sans dépendance à un service cloud**.

### 2.2 Objectifs secondaires

- Garantir la **reproductibilité** : `docker compose up` suffit, sur Linux
  comme sur macOS/WSL.
- Garantir la **souveraineté des données** : aucun document utilisateur,
  aucune requête, aucune clé n'est envoyée à un service tiers.
- Garantir la **sécurité** : prévention des attaques par prompt injection
  documentée et testée.
- Garantir la **transparence** du raisonnement : l'UI affiche les étapes
  intermédiaires (`thoughts`) du routeur et des agents.

### 2.3 Critères de succès

| Indicateur | Cible |
|---|---|
| Démarrage à partir de zéro | < 5 min (pull modèle inclus) |
| Génération d'un quiz 5 questions | < 60 s en CPU pur |
| Précision des sources citées | 100 % des questions sourcées ont une référence valide |
| Réussite des tests automatisés | 100 % des tests `pytest` au vert |
| Conformité « LLM local » | Aucune sortie réseau vers un domaine cloud LLM |

---

## 3. Périmètre fonctionnel

### 3.1 Fonctionnalités incluses (in-scope)

| ID | Fonctionnalité | Priorité |
|---|---|---|
| F1 | Ingestion de documents (PDF, DOCX, TXT, MD) via UI ou CLI | Must |
| F2 | Indexation vectorielle des chunks avec embeddings locaux | Must |
| F3 | Génération de quiz QCM + questions ouvertes (1 à 20 questions) | Must |
| F4 | Sélection dynamique du modèle LLM local | Must |
| F5 | Affichage des sources (fichier + page) sur chaque question | Must |
| F6 | Recherche web externe (DuckDuckGo) pour questions hors document | Should |
| F7 | Reset complet du store vectoriel et de la mémoire | Must |
| F8 | Réinitialisation automatique à chaque nouvel import (un seul doc actif) | Must |
| F9 | Détection et neutralisation des tentatives d'injection de prompt | Must |
| F10 | CLI Rich alternative au frontend web | Should |
| F11 | Mémoire conversationnelle bornée (N derniers échanges) | Should |
| F12 | API REST documentée (Swagger UI) | Must |

### 3.2 Fonctionnalités exclues (out-of-scope)

- **Authentification utilisateur** : projet local mono-utilisateur, pas de gestion d'identité
- **Multi-tenant** : un seul corpus actif à la fois
- **Édition manuelle du quiz généré** : sortie en lecture seule, à exporter
- **Internationalisation** : interface en français uniquement
- **Mode streaming** des réponses LLM (limitation simplificatrice)

---

## 4. Contraintes techniques

### 4.1 Contraintes imposées par le Module 11

| Contrainte | Implémentation |
|---|---|
| **Docker obligatoire** | `docker-compose.yml` orchestre tous les services |
| **LLM local obligatoire** | Service `ollama` + modèle `llama3.2:3b` par défaut |
| **RAG local** | ChromaDB + embeddings `sentence-transformers/all-MiniLM-L6-v2` |
| **Volume persistant** | Volumes `chroma_data`, `ollama_models`, `hf_cache` |
| **Réplicabilité** | Pas de dépendance à un chemin absolu ou à un OS spécifique |

### 4.2 Contraintes techniques propres

- **Python 3.11 ou 3.12** (limitation `sentence-transformers` et `chromadb`)
- **Node 20+** pour le frontend (Vite + React 18 + TypeScript strict)
- **httpx** comme client HTTP (pas de `requests`, async-ready)
- **pydantic v2** pour la validation des sorties LLM
- **LangGraph** pour l'orchestration multi-agents (pas de chaîne LangChain ad-hoc)

### 4.3 Contraintes non-fonctionnelles

| Catégorie | Exigence |
|---|---|
| **Performance** | Génération quiz 5 questions < 60s en CPU pur (modèle 3B) |
| **Empreinte mémoire** | < 4 Go pour les services hors modèle ; modèle de 2 Go par défaut |
| **Portabilité** | Linux x86_64, macOS Intel/Apple Silicon, Windows WSL2 |
| **Maintenabilité** | Tests `pytest` couvrant security + tools + rag (≥ 60 % lignes app/) |
| **Sécurité** | `prompt_guard` activé sur 100 % des entrées utilisateur |
| **Observabilité** | Logs structurés au niveau INFO par défaut, DEBUG configurable via `.env` |

---

## 5. Architecture cible (résumée)

L'architecture détaillée est documentée dans [architecture.md](architecture.md).
Vue d'ensemble :

- **Frontend** : React 18 + Vite + Tailwind, servi par nginx
- **Backend** : FastAPI + uvicorn, exposant 7 endpoints REST
- **Orchestrateur** : LangGraph avec 4 nœuds (router, rag, tools, finalizer)
- **LLM** : Ollama HTTP API, modèle `llama3.2:3b` par défaut
- **Vector DB** : ChromaDB HTTP (fallback PersistentClient local)
- **Embeddings** : `sentence-transformers/all-MiniLM-L6-v2` exécuté localement

---

## 6. Risques identifiés et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| LLM local trop lent en CPU pur | Élevée | Moyen | Modèle 3B par défaut ; allowlist 2B disponible |
| Hallucination hors contexte | Moyenne | Élevé | Prompt système strict + citations obligatoires |
| Prompt injection via document malveillant | Moyenne | Élevé | `prompt_guard` + system prompts verrouillés |
| Quiz JSON invalide | Moyenne | Moyen | Schéma pydantic + retry + salvage JSON tronqué |
| Pull modèle échoue (réseau) | Faible | Élevé | Message d'erreur clair, commande `ollama pull` documentée |
| Conflit ports hôte | Moyenne | Faible | Ports modifiables via override compose |

---

## 7. Livrables attendus

| Livrable | Format | Statut |
|---|---|---|
| Code source dockerisé | Dépôt Git public | ✅ Réalisé |
| Cahier des charges | `docs/specifications.md` (ce document) | ✅ Réalisé |
| Architecture détaillée + diagrammes | `docs/architecture.md` (Mermaid) | ✅ Réalisé |
| Documentation sécurité | `docs/security.md` | ✅ Réalisé |
| Rapport final | `docs/report.pdf` | ✅ Réalisé |
| README utilisateur | `README.md` (installation + usage) | ✅ Réalisé |
| Tests automatisés | `tests/` (pytest) | ✅ Réalisé |
| Démonstration locale | Scénario reproductible décrit dans le rapport | ✅ Réalisé |

---

## 8. Valeur ajoutée par rapport à l'existant

| Solution existante | Limitation | Apport de quizz-cours-IA |
|---|---|---|
| Kahoot / Quizlet | Pas de génération depuis document | Ingestion PDF/DOCX native |
| ChatGPT « génère un quiz » | Pas d'ancrage document, pas de citation source | RAG strict + sources fichier:page |
| Plugins LMS (Moodle Quiz Generator) | Cloud-only, données envoyées à OpenAI | 100 % local, aucune exfiltration |
| Pipelines artisanaux LangChain | Pas d'UI, pas de garanties de schéma | Frontend prêt + validation pydantic |

L'**originalité** du projet réside dans :

1. La **combinaison RAG + planificateur + outils + gouvernance** dans un seul
   pipeline LangGraph.
2. Le **fonctionnement 100 % local** via Ollama, conforme à l'esprit
   « Autonomous Agents & Local Intelligence » du lab.
3. La **réinitialisation automatique du store** à chaque import pour garantir
   l'isolation entre documents successifs (UX non triviale).
4. La **récupération de JSON tronqué** (`_salvage_truncated_json`) qui rend
   le système robuste aux limites de contexte des petits modèles locaux.
