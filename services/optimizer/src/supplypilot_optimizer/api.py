"""HTTP API (FastAPI). Versioned under /v1.

GET  /v1/health    service + dataset status
POST /v1/optimize  lowest total delivered cost for one buyer's basket (see models.py)
"""

from __future__ import annotations

import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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


MAX_BODY_BYTES = 256 * 1024  # a 200-line basket is ~20 KB


@app.middleware("http")
async def limit_body_size(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Reject oversized bodies before they're read (header check + streamed count)."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request body too large"}, status_code=413)
    if request.method in ("POST", "PUT", "PATCH"):
        body = b""
        async for chunk in request.stream():
            body += chunk
            if len(body) > MAX_BODY_BYTES:
                return JSONResponse({"detail": "Request body too large"}, status_code=413)
        request._body = body  # let FastAPI read the buffered body
    return await call_next(request)


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """If OPTIMIZER_API_KEY is set, callers must send it as X-API-Key (constant-time compare).

    The optimizer should only ever be called by the web app's server; in production set the
    same random value in both services (see docs/deployment.md).
    """
    expected = os.environ.get("OPTIMIZER_API_KEY")
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")


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
    responses={
        401: {"description": "OPTIMIZER_API_KEY is set and the X-API-Key header is missing or wrong"},
        413: {"description": "Request body too large"},
        422: {"description": "Invalid request, or it refers to an unknown buyer, product, unit or zone"},
    },
    dependencies=[Depends(require_api_key)],
)
def optimize_basket(request: OptimizeRequest) -> OptimizeResponse:
    """Find the lowest total delivered cost (items + delivery fees) for one buyer's basket.

    An infeasible basket is a normal answer (status "infeasible" with `problems`), not an error.
    """
    try:
        return optimize(request)
    except RequestError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
