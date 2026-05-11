#!/usr/bin/env bash
# Run the backend pytest suite inside the running backend container.
# Usage: bash scripts/run_tests.sh
set -euo pipefail

docker compose exec backend pytest -v "$@"
