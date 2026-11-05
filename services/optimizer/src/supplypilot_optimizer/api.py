"""HTTP API (FastAPI). Versioned under /v1.

Milestone 1 endpoints are read-only. POST /v1/optimize arrives in Milestone 3.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import __version__
from .catalog import get_catalog

app = FastAPI(title="SupplyPilot Optimizer", version=__version__)

# Browser calls go through the Next.js server, so CORS is only opened for local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)


class Health(BaseModel):
    status: str
    version: str
    dataset: str
    synthetic: bool
    data_label: str
    counts: dict[str, int]


@app.get("/v1/health", response_model=Health)
def health() -> Health:
    c = get_catalog()
    return Health(
        status="ok",
        version=__version__,
        dataset=c.meta.dataset,
        synthetic=c.meta.synthetic,
        data_label=c.meta.label,
        counts={
            "suppliers": len(c.suppliers),
            "products": len(c.products),
            "offers": len(c.offers),
            "buyers": len(c.buyers),
            "scenarios": len(c.scenarios),
        },
    )
