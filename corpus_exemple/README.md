# Corpus d'exemple

Deux supports de cours en français, suffisants pour démontrer la chaîne RAG + génération QCM sans dépendre de documents externes.

| Fichier | Sujet | Format | Licence |
|---------|-------|--------|---------|
| `cours_python_bases.md` | Bases du langage Python (types, structures, complexité) | Markdown | Original, rédigé pour ce projet |
| `cours_reseaux_intro.md` | Introduction aux réseaux (OSI, TCP/IP, DNS, sécurité) | Markdown | Original, rédigé pour ce projet |

## Indexation rapide

Une fois la stack démarrée (`make run` puis `make pull-model`), indexez le corpus :

```
bash scripts/seed_corpus.sh
```

Ou bien depuis l'interface Streamlit (`http://localhost:8501` → page Upload) en glissant-déposant les fichiers.

## Ajout de vos propres cours

Tous les formats suivants sont supportés :

- `.pdf` (extraction via PyMuPDF, pas d'OCR sur PDF scannés)
- `.md` / `.markdown`
- `.txt`

Pour les PDF scannés, convertissez-les en texte ou en Markdown avant import (l'OCR Tesseract est volontairement hors du périmètre).
