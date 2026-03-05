# DS AI OS — Development Makefile
# Usage:
#   make dev      — Start everything (infra + backend + celery + frontend)
#   make infra    — Start PostgreSQL + Redis only
#   make backend  — Start FastAPI backend
#   make celery   — Start Celery worker
#   make frontend — Start Vite dev server
#   make stop     — Stop Docker infra
#   make db-init  — Initialize database (run migrations)
#   make db-reset — Drop and recreate the database
#   make install  — Install all Python + Node dependencies
#   make lint     — Run Python linting
#   make test     — Run backend tests

.PHONY: dev infra backend celery frontend stop db-init db-reset install lint test

# ─── Configuration ─────────────────────────────────────────────────────────────
PYTHON       ?= python3
PIP          ?= pip3
VENV         ?= backend/.venv
ACTIVATE     ?= . $(VENV)/bin/activate &&
BACKEND_DIR  = backend
FRONTEND_DIR = frontend
PORT_API     ?= 8000
PORT_VITE    ?= 5173

# ─── Main targets ──────────────────────────────────────────────────────────────

## Start everything for local development
dev: infra
	@echo "Starting backend, celery, and frontend..."
	@$(MAKE) -j3 _backend _celery _frontend

_backend:
	cd $(BACKEND_DIR) && $(ACTIVATE) uvicorn main:app --reload --host 0.0.0.0 --port $(PORT_API)

_celery:
	cd $(BACKEND_DIR) && $(ACTIVATE) celery -A core.celery_app worker --loglevel=info

_frontend:
	cd $(FRONTEND_DIR) && npm run dev -- --port $(PORT_VITE)

## Start only infrastructure (PostgreSQL + Redis via Docker Compose)
infra:
	docker compose up -d postgres redis
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 2
	@echo "Infrastructure ready."

## Stop infrastructure
stop:
	docker compose down

## Initialize database (apply Alembic migrations)
db-init: infra
	cd $(BACKEND_DIR) && $(ACTIVATE) alembic upgrade head
	@echo "Database initialized."

## Reset database (drop all + re-migrate)
db-reset: infra
	@echo "WARNING: This will DELETE all data. Press Ctrl-C to cancel, Enter to continue."
	@read _confirm
	docker compose exec postgres psql -U dsaios -c "DROP DATABASE IF EXISTS ds_ai_os;"
	docker compose exec postgres psql -U dsaios -c "CREATE DATABASE ds_ai_os;"
	$(MAKE) db-init

## Install all dependencies
install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && $(PIP) install -r requirements.txt

install-frontend:
	cd $(FRONTEND_DIR) && npm install

## Setup virtual environment (optional, uses system pip by default)
venv:
	$(PYTHON) -m venv $(VENV)
	$(ACTIVATE) pip install --upgrade pip
	$(ACTIVATE) pip install -r $(BACKEND_DIR)/requirements.txt
	@echo "Virtual environment created at $(VENV)"
	@echo "Activate with: source $(VENV)/bin/activate"

## Run backend only (without celery/frontend)
backend: infra
	cd $(BACKEND_DIR) && $(ACTIVATE) uvicorn main:app --reload --host 0.0.0.0 --port $(PORT_API)

## Run celery worker only
celery: infra
	cd $(BACKEND_DIR) && $(ACTIVATE) celery -A core.celery_app worker --loglevel=info

## Run frontend only
frontend:
	cd $(FRONTEND_DIR) && npm run dev -- --port $(PORT_VITE)

## Build frontend for production
build-frontend:
	cd $(FRONTEND_DIR) && npm run build
	@echo "Frontend built to $(FRONTEND_DIR)/dist/"

## Run linting
lint:
	cd $(BACKEND_DIR) && $(ACTIVATE) ruff check . || true

## Run tests
test:
	cd $(BACKEND_DIR) && $(ACTIVATE) pytest tests/ -v

## Show logs
logs:
	docker compose logs -f

## Show service status
status:
	docker compose ps
	@echo ""
	@echo "API:      http://localhost:$(PORT_API)"
	@echo "API Docs: http://localhost:$(PORT_API)/docs"
	@echo "Frontend: http://localhost:$(PORT_VITE)"

## Help
help:
	@echo "DS AI OS Development Commands:"
	@echo ""
	@echo "  make dev          Start everything (infra + backend + celery + frontend)"
	@echo "  make infra        Start PostgreSQL + Redis"
	@echo "  make backend      Start FastAPI API server"
	@echo "  make celery       Start Celery worker"
	@echo "  make frontend     Start Vite dev server"
	@echo "  make stop         Stop Docker infrastructure"
	@echo "  make db-init      Run Alembic migrations"
	@echo "  make db-reset     Drop + recreate database (DESTRUCTIVE)"
	@echo "  make install      Install all dependencies"
	@echo "  make venv         Create Python virtual environment"
	@echo "  make build-frontend  Build frontend for production"
	@echo "  make lint         Run linter"
	@echo "  make test         Run backend tests"
	@echo "  make status       Show URLs and service status"
	@echo ""
	@echo "Environment variables:"
	@echo "  PORT_API=8000     FastAPI port"
	@echo "  PORT_VITE=5173    Vite dev server port"
