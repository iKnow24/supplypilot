"""Baseline, savings, preferences, alternatives, determinism and the HTTP endpoint."""

from __future__ import annotations

from conftest import run, scenario_request, text, used_suppliers
from fastapi.testclient import TestClient

from supplypilot_optimizer.api import app
from supplypilot_optimizer.catalog import Catalog
from supplypilot_optimizer.optimize import optimize


def _habit(catalog: Catalog, buyer: str) -> dict[str, str]:
    b = next(x for x in catalog.buyers if x.id == buyer)
    return {
        line.product_id: line.current_supplier_id
        for lst in b.saved_lists
        for line in lst.lines
        if line.current_supplier_id
    }


def test_savings_are_measured_against_the_priced_baseline(catalog: Catalog) -> None:
    habit = _habit(catalog, "org_sundaycrumb")
    sc_lines = next(s for s in catalog.scenarios if s.id == "scn_02_bundle_one_supplier").lines
    baseline = {"lines": [{"product_id": line.product_id, "supplier_id": habit[line.product_id]} for line in sc_lines]}
    r = run(catalog, "scn_02_bundle_one_supplier", baseline=baseline)
    assert r.baseline and r.baseline.status == "priced" and r.baseline.plan
    assert r.savings_cents == r.baseline.plan.total_cents - r.recommendation.total_cents  # type: ignore[union-attr]
    assert r.savings_cents is not None and r.savings_cents >= 0


def test_no_savings_without_a_complete_baseline(catalog: Catalog) -> None:
    r = run(
        catalog,
        "scn_01_cheap_items_not_cheap_basket",
        baseline={"lines": [{"product_id": "prd_milk_whole", "supplier_id": "sup_meadowlark"}]},
    )
    assert r.baseline and r.baseline.status == "unavailable" and r.savings_cents is None
    assert "No usual supplier for Oat milk" in (r.baseline.reason or "")


def test_no_savings_when_the_usual_supplier_cant_deliver_that_day(catalog: Catalog) -> None:
    # Tuesday: Kestrel doesn't deliver, so a Kestrel habit can't be priced.
    r = run(
        catalog,
        "scn_04_minimum_invalidates_cheap_supplier",
        delivery_date="2026-11-10",
        baseline={
            "lines": [{"product_id": p, "supplier_id": "sup_kestrel"} for p in ("prd_onion_yellow", "prd_tomato_roma")]
        },
    )
    assert r.status == "optimal"
    assert r.baseline and r.baseline.status == "unavailable" and r.savings_cents is None
    assert "Kestrel" in (r.baseline.reason or "") and "Tuesdays" in (r.baseline.reason or "")


def test_excluding_a_supplier_is_respected_and_reported(catalog: Catalog) -> None:
    r = run(catalog, "scn_01_cheap_items_not_cheap_basket", preferences={"excluded_supplier_ids": ["sup_meadowlark"]})
    assert "sup_meadowlark" not in used_suppliers(r)
    assert any(x.code == "excluded_by_buyer" for e in r.excluded_offers for x in e.reasons)


def test_preferred_suppliers_get_their_own_alternative(catalog: Catalog) -> None:
    r = run(catalog, "scn_01_cheap_items_not_cheap_basket", preferences={"preferred_supplier_ids": ["sup_pelican"]})
    assert used_suppliers(r) == ["sup_meadowlark"]  # preference never overrides a lower total
    pref = next(a for a in r.alternatives if a.kind == "preferred_suppliers")
    assert [s.supplier_id for s in pref.plan.suppliers] == ["sup_pelican"] and pref.delta_cents > 0


def test_fewest_suppliers_alternative_when_a_split_is_cheaper(catalog: Catalog) -> None:
    r = run(catalog, "scn_02_bundle_one_supplier", delivery_date="2026-11-12")
    if len(r.recommendation.suppliers) > 1:  # type: ignore[union-attr]
        alt = next(a for a in r.alternatives if a.kind == "fewest_suppliers")
        assert alt.plan.supplier_count < r.recommendation.supplier_count  # type: ignore[union-attr]
        assert alt.delta_cents >= 0


def test_same_input_same_answer(catalog: Catalog) -> None:
    a = run(catalog, "scn_02_bundle_one_supplier").model_dump()
    b = run(catalog, "scn_02_bundle_one_supplier").model_dump()
    assert a == b


def test_overbuy_is_reported_in_the_requested_unit(catalog: Catalog) -> None:
    r = run(catalog, "scn_05_delivery_day_changes_answer")
    cold = next(line for line in r.recommendation.lines if line.product_id == "prd_cup_cold_16")  # type: ignore[union-attr]
    assert (cold.requested_quantity, cold.purchased_quantity, cold.overbuy_quantity) == ("1000", "1200", "200")
    assert "200 more than you asked" in text(r)


def test_totals_add_up(catalog: Catalog) -> None:
    for sc in catalog.scenarios:
        r = optimize(scenario_request(catalog, sc.id), catalog)
        if r.recommendation is None:
            continue
        p = r.recommendation
        assert p.total_cents == p.items_subtotal_cents + p.fees_cents
        assert p.items_subtotal_cents == sum(s.items_subtotal_cents for s in p.suppliers)
        assert p.fees_cents == sum(s.delivery_fee_cents for s in p.suppliers)
        for s in p.suppliers:
            assert s.items_subtotal_cents == sum(a.line_total_cents for a in s.allocations)
            assert s.items_subtotal_cents >= s.min_order_cents
            assert all(a.line_total_cents == a.packs * a.pack_price_cents for a in s.allocations)


# ---------------------------------------------------------------------------------- HTTP


def test_endpoint_returns_a_plan(catalog: Catalog) -> None:
    body = scenario_request(catalog, "scn_01_cheap_items_not_cheap_basket").model_dump()
    r = TestClient(app).post("/v1/optimize", json=body)
    assert r.status_code == 200
    assert r.json()["status"] == "optimal" and r.json()["data"]["synthetic"] is True


def test_endpoint_infeasible_is_a_200_with_problems(catalog: Catalog) -> None:
    body = scenario_request(catalog, "scn_07_no_feasible_solution").model_dump()
    r = TestClient(app).post("/v1/optimize", json=body)
    assert r.status_code == 200 and r.json()["status"] == "infeasible" and r.json()["problems"]


def test_endpoint_rejects_bad_input(catalog: Catalog) -> None:
    client = TestClient(app)
    good = scenario_request(catalog, "scn_01_cheap_items_not_cheap_basket").model_dump()
    assert client.post("/v1/optimize", json={**good, "buyer_id": "org_nope"}).status_code == 422
    assert client.post("/v1/optimize", json={**good, "surprise": 1}).status_code == 422
    dup = [*good["lines"], good["lines"][0]]
    assert client.post("/v1/optimize", json={**good, "lines": dup}).status_code == 422
    neg = [{**good["lines"][0], "quantity": "-1"}]
    assert client.post("/v1/optimize", json={**good, "lines": neg}).status_code == 422


# --------------------------------------------------------------------------- infeasibility


def test_explains_a_minimum_that_cant_be_reached(catalog: Catalog) -> None:
    # Monday: only Kestrel delivers flour, and one bag is nowhere near its $400 minimum.
    line = [{"product_id": "prd_flour_ap_unbl", "quantity": "1", "unit": "lb"}]
    r = run(catalog, "scn_02_bundle_one_supplier", delivery_date="2026-11-09", lines=line)
    assert r.status == "infeasible"
    codes = {(p.scope, p.code) for p in r.problems}
    assert ("supplier", "minimum_unreachable") in codes and ("line", "only_below_minimum") in codes
    assert any("Kestrel's $400.00 minimum" in p.message for p in r.problems)


def test_explains_not_enough_stock(catalog: Catalog) -> None:
    # 400 lb of butter on Tuesday: Meadowlark + Bramblewood hold 8 cases = 288 lb between them.
    line = [{"product_id": "prd_butter_unsalted", "quantity": "400", "unit": "lb"}]
    r = run(catalog, "scn_03_stock_forces_two_suppliers", lines=line)
    assert r.status == "infeasible"
    assert [(p.code, p.product_id) for p in r.problems] == [("insufficient_stock", "prd_butter_unsalted")]
    assert "Only 288 lb" in r.problems[0].message and "you asked for 400" in r.problems[0].message
