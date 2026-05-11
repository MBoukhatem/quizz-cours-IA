# Tuteur Quiz Adaptatif --- shortcuts
# Usage: make <target>

COMPOSE ?= docker compose

.PHONY: help run up stop down restart logs ps build pull-model test test-backend shell-backend shell-frontend clean reset

help:
	@echo "Available targets:"
	@echo "  make run           - Build and start the full stack (detached)"
	@echo "  make up            - Alias for run"
	@echo "  make stop          - Stop services (containers kept)"
	@echo "  make down          - Stop and remove containers (volumes preserved)"
	@echo "  make restart       - Restart the stack"
	@echo "  make logs          - Tail logs from all services"
	@echo "  make ps            - Show running containers"
	@echo "  make build         - Rebuild backend and frontend images"
	@echo "  make pull-model    - Pull the Ollama model defined in .env"
	@echo "  make test          - Run backend pytest suite inside the container"
	@echo "  make shell-backend - Open a shell in the backend container"
	@echo "  make clean         - Remove containers, orphans, and dangling volumes"
	@echo "  make reset         - Full wipe (containers, data/, ollama_data)"

run: up

up:
	$(COMPOSE) up -d --build
	@echo ""
	@echo "Stack is starting. After Ollama becomes healthy, run: make pull-model"
	@echo "Then open:"
	@echo "  Backend  : http://localhost:8000/docs"
	@echo "  Frontend : http://localhost:8501"

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

pull-model:
	@bash scripts/init_ollama.sh

test: test-backend

test-backend:
	$(COMPOSE) exec backend pytest -v

shell-backend:
	$(COMPOSE) exec backend /bin/bash

shell-frontend:
	$(COMPOSE) exec frontend /bin/bash

clean:
	$(COMPOSE) down --remove-orphans
	@docker volume prune -f

reset:
	$(COMPOSE) down -v --remove-orphans
	@rm -rf data/uploads/* data/chroma/* data/logs/* data/db/*
	@touch data/uploads/.gitkeep data/chroma/.gitkeep data/logs/.gitkeep data/db/.gitkeep
	@echo "Reset complete."
