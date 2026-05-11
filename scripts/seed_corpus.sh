#!/usr/bin/env bash
# Index the example corpus into ChromaDB via the running backend API.
# Usage: bash scripts/seed_corpus.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CORPUS_DIR="$ROOT_DIR/corpus_exemple"
BACKEND="http://localhost:8000"

if ! curl -fsS "$BACKEND/api/health" >/dev/null 2>&1; then
    echo "ERROR: backend not reachable at $BACKEND."
    echo "       Start the stack first with: make run"
    exit 1
fi

echo "Indexing example corpus from: $CORPUS_DIR"
indexed=0
for f in "$CORPUS_DIR"/*.{pdf,md,txt}; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    echo "  -> uploading $name"
    curl -fsS -X POST "$BACKEND/api/upload" -F "file=@$f" || {
        echo "    FAILED for $name"
        continue
    }
    echo ""
    indexed=$((indexed + 1))
done

echo ""
echo "Indexed $indexed file(s)."
echo "List with: curl $BACKEND/api/documents"
