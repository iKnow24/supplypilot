"""SupplyPilot optimizer service.

Typed catalog contract, exact unit math, offer eligibility and the CP-SAT
total-delivered-cost optimizer behind POST /v1/optimize.
"""

__version__ = "0.1.0"


def main() -> None:
    """Entry point for `uv run supplypilot-optimizer` (dev server)."""
    import uvicorn

    uvicorn.run("supplypilot_optimizer.api:app", host="127.0.0.1", port=8000, reload=True)
