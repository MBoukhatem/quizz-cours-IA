# Architecture — quizz-cours-IA

## Diagramme des composants

```
                          +----------+
                          |  User    |
                          +----+-----+
                               |
                               v
                          +----+-----+
                          |   CLI    |  (Rich, commandes /ingest /reset)
                          +----+-----+
                               |
                               v
                    +----------+-----------+
                    |   LangGraph Graph    |
                    |                      |
                    |   +------------+     |
                    |   |  Router    |-----+-----> OpenRouter LLM
                    |   +-----+------+     |
                    |         |            |
                    |   ------+------      |
                    |   |            |     |
                    |   v            v     |
                    | +---------+ +-------+|
                    | |RAG agent| |Tools  ||
                    | |         | |agent  ||
                    | +----+----+ +---+---+|
                    |      |           |   |
                    |      v           v   |
                    | +----------+ +------+|
                    | |ChromaDB  | |Duck- ||
                    | |(vecteurs)| |DuckGo||
                    | +----------+ +------+|
                    |              +------+|
                    |              |Quiz  ||
                    |              |gener.||
                    |              +------+|
                    |         |            |
                    |         v            |
                    |   +------------+     |
                    |   | Finalizer  |     |
                    |   +-----+------+     |
                    +---------|------------+
                               |
                               v
                          +----+-----+
                          |  User    |
                          +----------+
```

Tous les nœuds (Router, RAG agent, Tools agent, Finalizer) appellent OpenRouter pour les
complétions LLM. ChromaDB est accessible soit via le conteneur Docker (CHROMA_HOST), soit en
mode local PersistentClient (./.chroma) si le conteneur est indisponible.

## Cycle de vie d'une requête

1. L'utilisateur saisit une requête dans le REPL (CLI Rich).
2. Le **Router** analyse la requête : mots-clés heuristiques puis appel LLM si ambigu.
   Il écrit `state["route"]` = `"rag"` ou `"tools"`.
3. Si `route == "rag"` : le **RAG agent** interroge ChromaDB (embeddings locaux
   sentence-transformers), récupère les k=4 chunks les plus pertinents et construit un prompt
   avec citations `[Source: fichier, page: N]`.
4. Si `route == "tools"` : le **Tools agent** décide si une recherche web est nécessaire,
   appelle DuckDuckGo le cas échéant, puis invoque `quiz_generator` avec les snippets comme
   contexte.
5. Dans les deux cas, `quiz_generator` produit un objet `Quiz` (Pydantic) strictement valide.
6. Le **Finalizer** formate la réponse finale, met à jour `state["final_answer"]` et
   `state["thoughts"]`.
7. La CLI affiche les thoughts dans l'ordre (Routeur -> RAG/Outil -> Final) avec les couleurs
   Rich définies dans `app/cli.py`.
8. La mémoire de conversation (`ConversationMemory`) conserve les MAX_HISTORY_TURNS derniers
   échanges et les injecte dans chaque appel LLM.

## Orchestration

Le graphe est construit par `app/graph.py` en utilisant **LangGraph** comme machine à états.
Les transitions sont conditionnelles sur `state["route"]` (edge conditionnel START -> router ->
rag | tools -> finalizer -> END). L'état partagé (`GraphState`, TypedDict) est le seul canal de
communication entre les nœuds ; aucun état global mutable n'est utilisé en dehors du graphe.
