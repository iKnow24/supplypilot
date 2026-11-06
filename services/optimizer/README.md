# SupplyPilot optimizer service

Python 3.11+ FastAPI service. Owns all pricing math and the OR-Tools CP-SAT basket optimizer
behind `POST /v1/optimize`. See the repo root README for how to run it, and
`docs/api-contract.md` for the contract and the rules the optimizer promises.

| Module | What |
| --- | --- |
| `catalog.py` | Strict catalog contract + referential integrity |
| `units.py` | Exact unit conversion (Fractions) |
| `models.py` | `/v1/optimize` request/response (source of `docs/openapi.json`) |
| `eligibility.py` | Delivery rules, freshness, stock, exclusions, equivalents, price schedules |
| `solver.py` | CP-SAT model and lexicographic tie-breaks |
| `optimize.py` | Orchestration: alternatives, baseline, explanations, infeasibility |

```bash
uv sync
uv run pytest          # tests (incl. the 8 scenarios + a brute-force cross-check)
uv run ruff check .    # lint
uv run mypy src        # typecheck
uv run supplypilot-optimizer   # dev server on http://127.0.0.1:8000 (docs at /docs)
```
