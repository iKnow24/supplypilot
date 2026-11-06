.PHONY: setup dev web optimizer test lint seed check api-types db-start db-stop db-reset db-status db-env db-types db-doctor e2e

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

# Local Supabase (Postgres + Auth + REST) in Docker. Needs a running Docker engine (OrbStack).
SUPABASE := apps/web/node_modules/.bin/supabase --workdir .

db-start:         ## Start local Supabase, then write apps/web/.env.local
	$(SUPABASE) start
	$(MAKE) db-env

db-env:           ## Write local Supabase URL/key + DEMO_AUTH=on into apps/web/.env.local
	$(SUPABASE) status -o env | node apps/web/scripts/write-local-env.mjs apps/web/.env.local

db-stop:          ## Stop it (data is kept in a Docker volume)
	$(SUPABASE) stop

db-reset:         ## Wipe local DB, re-run supabase/migrations + seed
	python3 supabase/generate_seed_sql.py
	$(SUPABASE) db reset

db-doctor:        ## Check the Docker VM clock (sign-in breaks if it drifts after sleep)
	@sh supabase/doctor.sh

db-types:         ## Regenerate apps/web/src/lib/db/database.types.ts from the local schema
	$(SUPABASE) gen types typescript --local --schema public > apps/web/src/lib/db/database.types.ts
	cd apps/web && npx prettier --write src/lib/db/database.types.ts

e2e:              ## Playwright end-to-end tests (needs make db-start)
	cd apps/web && npm run test:e2e

db-status:        ## Show URLs and local keys again
	$(SUPABASE) status
