.PHONY: setup dev web optimizer test lint seed check db-start db-stop db-reset db-status

setup:            ## Install everything
	cd apps/web && npm install
	cd services/optimizer && uv sync

seed:             ## Regenerate the synthetic demo catalog
	python3 data/seed/generate_seed.py

web:              ## Web app on http://localhost:3000
	cd apps/web && npm run dev

optimizer:        ## Optimizer API on http://127.0.0.1:8000 (docs at /docs)
	cd services/optimizer && uv run supplypilot-optimizer

dev:              ## Both, in one terminal (Ctrl+C stops both)
	$(MAKE) -j2 web optimizer

test:
	cd services/optimizer && uv run pytest -q
	cd apps/web && npm test

lint:
	cd services/optimizer && uv run ruff check . && uv run ruff format --check . && uv run mypy src
	cd apps/web && npm run lint && npm run typecheck && npm run format:check

check: lint test  ## Everything CI runs

# Local Supabase (Postgres + Auth + REST) in Docker. Needs a running Docker engine (OrbStack).
SUPABASE := apps/web/node_modules/.bin/supabase --workdir .

db-start:         ## Start local Supabase; prints URLs and local keys
	$(SUPABASE) start

db-stop:          ## Stop it (data is kept in a Docker volume)
	$(SUPABASE) stop

db-reset:         ## Wipe local DB, re-run supabase/migrations + seed
	$(SUPABASE) db reset

db-status:        ## Show URLs and local keys again
	$(SUPABASE) status
