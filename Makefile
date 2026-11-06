.PHONY: setup dev web optimizer test lint seed check api-types

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

api-types:        ## Regenerate docs/openapi.json + the web app's TS types from the optimizer's models
	cd services/optimizer && uv run python -m supplypilot_optimizer.openapi > ../../docs/openapi.json
	npx --yes openapi-typescript@7.13.0 docs/openapi.json -o apps/web/src/lib/optimizer/api-types.ts
	cd apps/web && npx prettier --write src/lib/optimizer/api-types.ts > /dev/null

check: lint test  ## Everything CI runs
