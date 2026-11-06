from __future__ import annotations

from typing import Any

import pytest

from supplypilot_optimizer.catalog import Catalog, get_catalog
from supplypilot_optimizer.models import OptimizeRequest, OptimizeResponse
from supplypilot_optimizer.optimize import optimize


@pytest.fixture(scope="session")
def catalog() -> Catalog:
    return get_catalog()


def scenario_request(catalog: Catalog, scenario_id: str, **overrides: Any) -> OptimizeRequest:
    sc = next(s for s in catalog.scenarios if s.id == scenario_id)
    body: dict[str, Any] = {
        "buyer_id": sc.buyer_id,
        "zone": sc.zone,
        "delivery_date": sc.delivery_date,
        "lines": [{"product_id": line.product_id, "quantity": line.quantity, "unit": line.unit} for line in sc.lines],
    }
    body.update(overrides)
    return OptimizeRequest.model_validate(body)


def run(catalog: Catalog, scenario_id: str, **overrides: Any) -> OptimizeResponse:
    return optimize(scenario_request(catalog, scenario_id, **overrides), catalog)


def used_suppliers(r: OptimizeResponse) -> list[str]:
    assert r.recommendation is not None
    return [s.supplier_id for s in r.recommendation.suppliers]


def text(r: OptimizeResponse) -> str:
    return "\n".join(r.explanations)
