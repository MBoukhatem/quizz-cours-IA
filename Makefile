.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up down build rebuild logs ps test clean pull-models pull-light pull-heavy cli report status

help: ## Affiche cette aide
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Démarre toute la stack (chromadb + ollama + api + web)
	$(COMPOSE) up

up-d: ## Démarre la stack en arrière-plan
	$(COMPOSE) up -d

build: ## Build les images (api + web)
	$(COMPOSE) build

rebuild: ## Rebuild from scratch (no cache) puis up
	$(COMPOSE) build --no-cache
	$(COMPOSE) up

down: ## Stoppe et supprime les conteneurs
	$(COMPOSE) down --remove-orphans

down-v: ## Comme down + supprime les volumes (perte des index et modèles)
	$(COMPOSE) down --remove-orphans -v

logs: ## Suit les logs de tous les services
	$(COMPOSE) logs -f --tail=100

logs-api: ## Suit uniquement les logs de l'API
	$(COMPOSE) logs -f --tail=200 api

ps: ## Affiche l'état des services
	$(COMPOSE) ps

status: ## Appelle GET /api/status
	@curl -s http://localhost:8000/api/status | python3 -m json.tool || echo "API indisponible"

test: ## Exécute la suite pytest dans le conteneur api
	$(COMPOSE) run --rm api pytest

test-local: ## Exécute pytest en local (sans Docker)
	pytest

pull-models: pull-tiny ## Alias de pull-tiny (modèle par défaut)

pull-tiny: ## Pull du modèle par défaut (qwen2.5:0.5b, ~400 Mo, < 1 Go RAM)
	$(COMPOSE) exec ollama ollama pull qwen2.5:0.5b

pull-light: ## Pull du modèle léger (llama3.2:3b, ~2 Go)
	$(COMPOSE) exec ollama ollama pull llama3.2:3b

pull-mini: ## Pull du modèle ultra-léger (gemma2:2b, ~1.6 Go)
	$(COMPOSE) exec ollama ollama pull gemma2:2b

pull-heavy: ## Pull du modèle qualité (qwen2.5:7b, ~4.7 Go — 16 Go RAM recommandés)
	$(COMPOSE) exec ollama ollama pull qwen2.5:7b

cli: ## Lance le REPL Rich (CLI alternative)
	$(COMPOSE) --profile cli run --rm cli

report: ## Régénère docs/report.pdf depuis docs/report.md
	python3 docs/_build_report.py

slides: ## Régénère docs/slides.pdf depuis docs/slides.md
	python3 docs/_build_slides.py

docs: report slides ## Régénère report.pdf + slides.pdf

clean: down ## Nettoie tout (conteneurs + dist frontend + caches Python)
	rm -rf web/dist web/node_modules .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
