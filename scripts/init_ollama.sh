#!/usr/bin/env bash
# Pull the Ollama model defined in .env into the running ollama container.
# Usage: bash scripts/init_ollama.sh
set -euo pipefail

# Load .env from the repo root (script may be run from anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
    # shellcheck disable=SC1090
    set -a
    . "$ROOT_DIR/.env"
    set +a
fi

MODEL="${OLLAMA_MODEL:-mistral:7b}"

echo "Pulling Ollama model: $MODEL"
echo "This can take a few minutes the first time (~4 GB for mistral:7b)."

if ! docker ps --format '{{.Names}}' | grep -q '^tuteur-quiz-ollama$'; then
    echo "ERROR: container 'tuteur-quiz-ollama' is not running."
    echo "       Start the stack first with: make run"
    exit 1
fi

docker exec -it tuteur-quiz-ollama ollama pull "$MODEL"

echo ""
echo "Model '$MODEL' is ready."
echo "Verify with: docker exec tuteur-quiz-ollama ollama list"
