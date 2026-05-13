# Plan de tests

## RAG (`tests/test_rag.py`)

| Cas | Description | Entrée | Sortie attendue | Statut |
|---|---|---|---|---|
| Nominal | Ingère `lecture_ml.md`, requête sur l'apprentissage supervisé | `"supervised learning"` + store peuplé | ≥ 1 chunk retourné, chaque chunk possède `source`, `page`, `score` float | `pytest tests/test_rag.py::test_rag_nominal_ingests_and_queries` |
| Limite | Requête hors-sujet sur un store peuplé avec le cours ML | `"comment cuisiner des pâtes"` | `final_answer` contient une mention explicite de l'absence de réponse dans le contexte | `pytest tests/test_rag.py::test_rag_edge_off_topic` |
| Erreur | Store vide, appel direct à `rag_node` | Requête quelconque, store sans chunks | `final_answer` contient `"Aucun document pertinent"`, aucune exception levée | `pytest tests/test_rag.py::test_rag_error_empty_store` |

## Outils (`tests/test_tools.py`)

| Cas | Description | Entrée | Sortie attendue | Statut |
|---|---|---|---|---|
| Nominal | LLM factice retourne un JSON de quiz valide avec 3 questions | JSON valide enfilé dans `FakeLLM` | Objet `Quiz` Pydantic parsé, 3 questions des bons types (`mcq`, `short`) | `pytest tests/test_tools.py::test_quiz_generator_nominal_valid_json` |
| Limite | Recherche web avec une requête vide | `web_search("")` | Liste vide `[]`, aucune exception, aucun appel réseau | `pytest tests/test_tools.py::test_web_search_edge_empty_query` |
| Erreur | LLM retourne deux fois du JSON invalide consécutivement | Deux réponses non-JSON enfilées dans `FakeLLM` | `QuizGenerationError` levée après le second échec de parsing | `pytest tests/test_tools.py::test_quiz_generator_error_invalid_json` |
