# API Reference

Base URL en local : `http://localhost:8000`

Swagger UI interactive : `/docs` · OpenAPI JSON : `/openapi.json`.

---

## Santé

### `GET /api/health`

Vérifie la connectivité d'Ollama et de ChromaDB.

**Réponse 200** :

```json
{
  "status": "ok",
  "components": [
    { "name": "ollama",   "healthy": true, "detail": "model 'mistral:7b' loaded" },
    { "name": "chromadb", "healthy": true, "detail": "42 chunks indexed" }
  ]
}
```

`status` ∈ `ok | degraded | down`.

---

## Documents

### `POST /api/upload`

Indexe un fichier PDF/MD/TXT (multipart form-data, champ `file`).

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@cours.pdf"
```

**Réponse 200** :

```json
{
  "document_id": "doc_3f5a8c0b1d22",
  "filename": "cours.pdf",
  "n_chunks": 47,
  "status": "indexed",
  "message": "47 chunks indexés."
}
```

Erreurs : `400` format non supporté · `422` aucun texte extractible (PDF scanné) · `500` erreur d'indexation.

### `GET /api/documents`

Liste paginée des documents indexés.

```json
{
  "documents": [
    { "document_id": "doc_xxx", "filename": "cours.pdf", "n_chunks": 47, "uploaded_at": "..." }
  ],
  "total": 1
}
```

### `DELETE /api/documents/{document_id}`

Supprime un document et ses chunks. `404` si inconnu.

---

## Quiz

### `POST /api/quiz/generate`

Génère une question QCM. Le planificateur choisit la difficulté si elle n'est pas forcée.

```json
{
  "session_id": "sess_abc",
  "difficulty": "facile",       // optionnel: facile|moyen|difficile
  "document_id": "doc_xxx"      // optionnel: restreindre à un document
}
```

**Réponse 200** :

```json
{
  "question_id": "q_4a9c0e1b6d11",
  "session_id": "sess_abc",
  "question": "Quelle est la complexité du tri par insertion ?",
  "choices": ["O(1)", "O(log n)", "O(n^2)", "O(2^n)"],
  "correct_index": 2,
  "difficulty": "facile",
  "source_document": "cours_python_bases.md",
  "source_page": null,
  "source_chunk": "Le tri par insertion a une complexité en O(n^2)...",
  "chunk_id": "doc_xxx::cours_python_bases.md::chunk_18"
}
```

Erreurs : `502` LLM injoignable ou réponse invalide après 2 tentatives.

### `POST /api/quiz/answer`

Corrige la réponse de l'étudiant.

```json
{
  "question_id": "q_4a9c0e1b6d11",
  "session_id": "sess_abc",
  "selected_index": 2
}
```

**Réponse 200** :

```json
{
  "is_correct": true,
  "correct_index": 2,
  "explanation": "Bonne réponse. Le tri par insertion est en O(n^2)...",
  "source_reference": "cours_python_bases.md",
  "new_difficulty": "moyen",
  "score_session": 7,
  "total_session": 9
}
```

### `GET /api/quiz/session/{session_id}`

État courant d'une session.

```json
{
  "session_id": "sess_abc",
  "total_questions": 9,
  "correct_answers": 7,
  "current_difficulty": "moyen",
  "success_rate": 77.78
}
```

---

## Statistiques

### `GET /api/stats/summary`

```json
{
  "total_questions": 47,
  "correct_answers": 31,
  "success_rate": 65.96,
  "current_difficulty": "moyen",
  "sessions_count": 5,
  "documents_indexed": 3,
  "total_chunks": 156
}
```

### `GET /api/stats/history?limit=50`

Historique des sessions (du plus récent au plus ancien) : `session_id`, `started_at`, `total_questions`, `correct_answers`, `success_rate`.

### `GET /api/stats/topics`

Performance agrégée par document source.

```json
{
  "topics": [
    { "source_document": "cours_python_bases.md", "total": 20, "correct": 14, "success_rate": 70.0 }
  ]
}
```

---

## Codes d'erreur

| Code | Sens |
|------|------|
| 400  | Requête invalide (format de fichier non supporté, index hors bornes, etc.) |
| 404  | Document inconnu |
| 422  | Document indexable techniquement mais sans contenu textuel utile |
| 500  | Erreur interne (extraction, indexation) |
| 502  | LLM ou Vector DB injoignable |
