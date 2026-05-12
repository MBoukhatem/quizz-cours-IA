# Référence API — Quizz-Cours-IA

Base URL (développement) : `http://localhost:8080`

Tous les corps de requête/réponse sont en JSON sauf `/ingest` (multipart).  
La validation est assurée par Zod via `fastify-type-provider-zod`.

---

## GET /health

Vérifie l'accessibilité des trois services externes.

**Réponse 200**

```ts
{
  status: "ok";
  services: {
    vllm:       "up" | "down";
    embeddings: "up" | "down";
    qdrant:     "up" | "down";
  };
}
```

**Exemple**

```bash
curl http://localhost:8080/health
```

```json
{
  "status": "ok",
  "services": { "vllm": "up", "embeddings": "up", "qdrant": "up" }
}
```

---

## POST /ingest

Ingère un ou plusieurs documents dans Qdrant. Corps en `multipart/form-data`.

**Contraintes**

- Extensions acceptées : `.pdf`, `.docx`, `.md`, `.txt`
- Taille maximale par fichier : 25 Mo
- Les fichiers hors critères sont ignorés silencieusement (warning dans les logs).

**Réponse 200**

```ts
{
  ingested: Array<{
    source: string;   // chemin du fichier sauvegardé
    chunks: number;   // nombre de chunks upsertés dans Qdrant
  }>;
}
```

**Exemple**

```bash
curl -X POST http://localhost:8080/ingest \
  -F "file=@cours_reseaux.pdf" \
  -F "file=@cours_python.md"
```

```json
{
  "ingested": [
    { "source": "data/uploads/a1b2c3_cours_reseaux.pdf", "chunks": 42 },
    { "source": "data/uploads/d4e5f6_cours_python.md",   "chunks": 18 }
  ]
}
```

---

## POST /chat

Lance une session de chat avec le graph multi-agents. La réponse est un flux
**Server-Sent Events** (SSE).

**Corps de la requête**

```ts
{
  threadId: string;   // UUID v4 — identifie la session (mémoire SQLite)
  message:  string;   // min 1 caractère, max 4000 caractères
}
```

**Réponse 200 — flux SSE**

Les en-têtes de réponse sont :

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

Chaque trame respecte le format SSE standard :

```
event: <type>
data: <json>

```

### Événements GraphEvent

#### `router.decision`

Émis par le noeud Router juste après la classification de l'intention.

```ts
{
  type:   "router.decision";
  route:  "rag" | "tools";              // branche choisie
  intent: "answer" | "quiz";            // ce que l'utilisateur veut
  reason: string;                       // justification du routeur
}
```

Exemple de trame :

```
event: router.decision
data: {"type":"router.decision","route":"rag","intent":"quiz","reason":"L'utilisateur demande un quiz sur le cours Python ingéré."}

```

#### `rag.docs`

Émis par l'Agent RAG après la recherche vectorielle, avant la génération.

```ts
{
  type:      "rag.docs";
  citations: Array<{
    id:     string;   // ID du chunk Qdrant
    source: string;   // nom du fichier source
    text:   string;   // extrait du chunk
    score:  number;   // score de similarité cosine
  }>;
}
```

Exemple de trame :

```
event: rag.docs
data: {"type":"rag.docs","citations":[{"id":"abc123","source":"cours_python.md","text":"Les listes Python sont...","score":0.91}]}

```

#### `tool.call`

Émis au démarrage de chaque appel d'outil dans la boucle ReAct (Agent Outils).

```ts
{
  type: "tool.call";
  name: string;                      // "web_search" | "quiz_generator" | ...
  args: Record<string, unknown>;     // arguments passés à l'outil
}
```

Exemple de trame :

```
event: tool.call
data: {"type":"tool.call","name":"quiz_generator","args":{"topic":"Listes Python","difficulty":"moyen","count":5}}

```

#### `tool.result`

Émis à la fin de chaque appel d'outil.

```ts
{
  type:   "tool.result";
  name:   string;   // même nom que dans tool.call correspondant
  result: string;   // résultat sérialisé (tronqué à l'affichage CLI, complet ici)
}
```

Exemple de trame :

```
event: tool.result
data: {"type":"tool.result","name":"web_search","result":"Python lists are ordered, mutable sequences..."}

```

#### `final.token`

Émis pour chaque token streamé par le LLM lors de la génération finale.

```ts
{
  type:  "final.token";
  token: string;
}
```

Exemple de trame :

```
event: final.token
data: {"type":"final.token","token":"Voici"}

```

#### `final.done`

Dernier événement du flux. Contient la réponse complète assemblée par l'Aggregator.

```ts
{
  type: "final.done";
  payload: {
    text?:     string;             // réponse textuelle (si intent=answer)
    quiz?: {                       // quiz structuré (si intent=quiz)
      topic:      string;
      difficulty: "facile" | "moyen" | "difficile";
      questions:  Array<McqQuestion | TrueFalseQuestion | OpenQuestion>;
    };
    citations: Array<{             // toujours présent (vide si branche outils pure)
      id:     string;
      source: string;
      text:   string;
      score:  number;
    }>;
  };
}
```

Exemple de trame (quiz) :

```
event: final.done
data: {"type":"final.done","payload":{"quiz":{"topic":"Listes Python","difficulty":"moyen","questions":[{"type":"mcq","question":"Quelle méthode ajoute un élément en fin de liste ?","options":["insert()","append()","add()","push()"],"answerIndex":1,"explanation":"append() ajoute à la fin, insert() à un index donné."}]},"citations":[]}}

```

### Réponse 400 — injection détectée

Si le guard heuristique détecte une tentative d'injection de prompt :

```ts
{
  error:  "prompt_injection_detected";
  reason: string;
}
```

**Exemple complet**

```bash
curl -X POST http://localhost:8080/chat \
  -H "Content-Type: application/json" \
  -d '{"threadId":"550e8400-e29b-41d4-a716-446655440000","message":"Crée un quiz de 3 questions QCM sur les listes Python."}'
```

---

## POST /quiz/submit

Soumet les réponses d'un utilisateur et retourne l'évaluation.

**Corps de la requête**

```ts
{
  quiz: {
    topic:      string;
    difficulty: "facile" | "moyen" | "difficile";
    questions:  Array<McqQuestion | TrueFalseQuestion | OpenQuestion>;
  };
  answers: Array<{
    questionIndex: number;                      // index 0-based dans questions[]
    answer:        string | number | boolean;   // selon le type de question
  }>;
}
```

Types de questions :

```ts
// QCM
{ type: "mcq";        question: string; options: [string,string,string,string]; answerIndex: 0|1|2|3; explanation: string }
// Vrai/Faux
{ type: "true_false"; question: string; answer: boolean; explanation: string }
// Ouverte
{ type: "open";       question: string; expectedAnswer: string; rubric: string }
```

**Réponse 200**

```ts
{
  items: Array<{
    questionIndex: number;
    correct:       boolean;
    score:         number;   // 0.0 – 1.0
    feedback:      string;
  }>;
  totalScore: number;   // 0.0 – 1.0, moyenne pondérée
  summary:    string;   // commentaire global du LLM évaluateur
}
```

**Exemple**

```bash
curl -X POST http://localhost:8080/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{
    "quiz": {
      "topic": "Listes Python",
      "difficulty": "moyen",
      "questions": [{
        "type": "mcq",
        "question": "Quelle méthode ajoute un élément en fin de liste ?",
        "options": ["insert()","append()","add()","push()"],
        "answerIndex": 1,
        "explanation": "append() ajoute à la fin."
      }]
    },
    "answers": [{ "questionIndex": 0, "answer": 1 }]
  }'
```

```json
{
  "items": [{ "questionIndex": 0, "correct": true, "score": 1.0, "feedback": "Bonne réponse." }],
  "totalScore": 1.0,
  "summary": "Parfait, toutes les réponses sont correctes."
}
```

---

## GET /quiz/sessions

Liste les sessions de quiz enregistrées pour un thread.

**Query string**

```ts
{
  threadId: string;   // UUID — obligatoire
  limit?:   number;   // entier 1–100, défaut : toutes
}
```

**Réponse 200**

```ts
{
  sessions: Array<{
    id:             string;
    threadId:       string;
    quizJson:       string;           // JSON sérialisé du Quiz
    createdAt:      number;           // timestamp Unix ms
    submittedAt:    number | null;
    answersJson:    string | null;
    evaluationJson: string | null;
    score:          number | null;    // 0.0 – 1.0
  }>;
}
```

**Exemple**

```bash
curl "http://localhost:8080/quiz/sessions?threadId=550e8400-e29b-41d4-a716-446655440000&limit=5"
```

---

## GET /quiz/sessions/:id

Retourne une session par son identifiant.

**Paramètre de chemin**

```ts
{ id: string }
```

**Réponse 200** — même forme qu'un élément du tableau `sessions` ci-dessus.

**Réponse 404**

```json
{ "error": "session_not_found" }
```

**Exemple**

```bash
curl http://localhost:8080/quiz/sessions/sess_abc123
```
