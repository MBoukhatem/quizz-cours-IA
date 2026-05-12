# Tableaux de tests obligatoires

## Comment exécuter la partie automatisée

Les tests unitaires couvrent les chemins déterministes (schémas Zod, chunker, aggregator, évaluateur MCQ/V-F, prompt-guard). Pour les lancer : `pnpm --filter @quizz/core test` (agent RAG + Outils) et `pnpm --filter @quizz/api test` (sécurité). Aucun service externe n'est requis : tous les tests évitent les appels réseau via des stubs `vi.fn()`.

---

## Tableau 1 — Agent RAG

| ID | Scenario | Input utilisateur | Réponse attendue | Vérification |
|----|----------|-------------------|------------------|--------------|
| RAG-01 | **Cas nominal** — question ancrée dans le corpus | `"Quels sont les avantages de l'encapsulation en POO selon le cours ?"` (après ingestion d'un cours sur la POO) | Réponse cohérente avec le contenu ingéré, citations de source (ex. `[cours_poo.pdf p.12] — chunk 7 (score: 0.912)`), ton pédagogique | Inspection visuelle du pied de page citations dans la réponse SSE ; log `rag.docs` vérifie que `retrieved.length >= 1` ; test unitaire `aggregator.test.ts` confirme la présence du bloc `Sources :` quand `state.citations` est non vide |
| RAG-02 | **Cas limite** — question hors sujet / hors corpus | `"Quel est le cours de la bourse du CAC 40 aujourd'hui ?"` | L'agent répond qu'il ne dispose pas d'information sur ce sujet dans le corpus ingéré ; il ne fabrique pas de données boursières | Inspection visuelle : la réponse doit contenir une formulation du type « Je ne trouve pas cette information dans les documents disponibles » ; absence de chiffres inventés ; log `retrieved.length === 0` ou score sous le seuil de pertinence |
| RAG-03 | **Cas d'erreur** — question induisant l'hallucination | `"Quel est le chapitre 99 du cours qui traite des réseaux quantiques auto-apprenants ?"` (sujet inexistant dans le corpus) | L'agent refuse d'inventer un contenu et cite explicitement l'absence de source correspondante ; il ne génère pas de « Chapitre 99 » fictif | Inspection visuelle : la réponse doit signaler l'absence de source ; le champ `citations` dans le payload SSE doit être vide ou ne pas contenir de chunk lié au sujet ; si la réponse contient du contenu inventé avec une citation fictive, statut = FAIL |

---

## Tableau 2 — Agent Outils

| ID | Scenario | Input utilisateur | Outil attendu | Comportement attendu | Vérification |
|----|----------|-------------------|---------------|----------------------|--------------|
| OUT-01 | **Cas nominal** — recherche web pédagogique | `"Quelles sont les nouveautés de React 19 ?"` | `web_search` | Le routeur classe la question `besoin_web` ; l'agent Tools appelle `web_search("React 19 nouveautés")` ; la réponse liste les nouvelles fonctionnalités (Suspense amélioré, Server Actions, etc.) avec les sources DuckDuckGo ; le format est lisible et structuré | Event SSE `tool.call` contient `name: "web_search"` ; event `tool.result` contient des résultats non vides ; inspection visuelle de la réponse finale ; aucun appel à `quiz_generator` dans les logs |
| OUT-02 | **Cas limite** — question hors périmètre pédagogique | `"Quel temps fait-il à Paris en ce moment ?"` | `web_search` (acceptable) | L'agent peut appeler `web_search` pour répondre, mais doit signaler dans sa réponse finale que la question ne s'inscrit pas dans un objectif pédagogique et proposer de revenir à un sujet de cours | Inspection visuelle : la réponse doit contenir un avertissement du type « Cette question sort du cadre pédagogique » ; event `router.decision` = `besoin_web` admis ; si l'agent répond sans avertissement sur le hors-périmètre, statut = WARN (non bloquant) |
| OUT-03 | **Cas d'erreur** — mauvais outil appelé | `"Génère un quiz sur les bases de Python"` (sans document ingéré, donc hors RAG) | `quiz_generator` | Le routeur classe `quiz_action` ; l'agent doit appeler `quiz_generator` avec le topic `"bases de Python"` ; la réponse est un objet JSON valide selon `QuizSchema` (topic, difficulty, questions) | Event SSE `tool.call` doit avoir `name: "quiz_generator"` ; si l'événement contient `name: "web_search"` à la place, statut = **FAIL** ; test unitaire `schemas.test.ts` (RAG-03-schema) vérifie que la sortie de `quiz_generator` passe `QuizSchema.parse()` sans erreur |
