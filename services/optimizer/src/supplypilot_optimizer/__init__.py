"""SupplyPilot optimizer service.

Milestone 1 ships the typed catalog contract, exact unit math and the HTTP
skeleton. The CP-SAT basket optimizer lands in Milestone 3.
"""

__version__ = "0.1.0"


def main() -> None:
    """Entry point for `uv run supplypilot-optimizer` (dev server)."""
    import uvicorn

    uvicorn.run("supplypilot_optimizer.api:app", host="127.0.0.1", port=8000, reload=True)
