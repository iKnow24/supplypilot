"""HTTP API (FastAPI). Versioned under /v1.

GET  /v1/health    service + dataset status
POST /v1/optimize  lowest total delivered cost for one buyer's basket (see models.py)
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import __version__
from .catalog import get_catalog
from .eligibility import RequestError
from .models import OptimizeRequest, OptimizeResponse
from .optimize import optimize

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


@app.post(
    "/v1/optimize",
    response_model=OptimizeResponse,
    responses={422: {"description": "Invalid request, or it refers to an unknown buyer, product, unit or zone"}},
)
def optimize_basket(request: OptimizeRequest) -> OptimizeResponse:
    """Find the lowest total delivered cost (items + delivery fees) for one buyer's basket.

    An infeasible basket is a normal answer (status "infeasible" with `problems`), not an error.
    """
    try:
        return optimize(request)
    except RequestError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
