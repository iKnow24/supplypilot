# SupplyPilot optimizer service

Python 3.11+ FastAPI service. Owns all pricing math and (from Milestone 3) the
OR-Tools CP-SAT basket optimizer. See the repo root README for how to run it.

```bash
uv sync
uv run pytest          # tests
uv run ruff check .    # lint
uv run mypy src        # typecheck
uv run supplypilot-optimizer   # dev server on http://127.0.0.1:8000 (docs at /docs)
```
