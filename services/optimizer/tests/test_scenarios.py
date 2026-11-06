"""The 8 seeded demo scenarios (docs/mvp-scope.md), asserted as business outcomes."""

from __future__ import annotations

from conftest import run, text, used_suppliers

from supplypilot_optimizer.catalog import Catalog


def test_01_cheapest_items_are_not_the_cheapest_basket(catalog: Catalog) -> None:
    r = run(catalog, "scn_01_cheap_items_not_cheap_basket")
    assert r.status == "optimal"
    assert used_suppliers(r) == ["sup_meadowlark"]
    cheap = next(a for a in r.alternatives if a.kind == "lowest_item_subtotal")
    assert [s.supplier_id for s in cheap.plan.suppliers] == ["sup_pelican"]
    assert cheap.plan.items_subtotal_cents < r.recommendation.items_subtotal_cents  # type: ignore[union-attr]
    assert cheap.delta_cents > 0
    assert "Pelican" in text(r) and "$45.00 delivery fee" in text(r)


def test_02_bundling_with_one_supplier_crosses_free_delivery(catalog: Catalog) -> None:
    r = run(catalog, "scn_02_bundle_one_supplier")
    assert used_suppliers(r) == ["sup_bramblewood"]
    order = r.recommendation.suppliers[0]  # type: ignore[union-attr]
    assert order.fee_waived and order.delivery_fee_cents == 0
    assert order.items_subtotal_cents >= 50_000
    # Buying the butter at Meadowlark is $5.10 cheaper per case but costs more delivered.
    cheap = next(a for a in r.alternatives if a.kind == "lowest_item_subtotal")
    butter = next(line for line in cheap.plan.lines if line.product_id == "prd_butter_unsalted")
    assert butter.allocations[0].supplier_id == "sup_meadowlark"
    assert r.recommendation.items_subtotal_cents - cheap.plan.items_subtotal_cents == 510  # type: ignore[union-attr]
    assert "free because the order reaches its $500.00 threshold" in text(r)


def test_03_stock_forces_a_split(catalog: Catalog) -> None:
    r = run(catalog, "scn_03_stock_forces_two_suppliers")
    line = r.recommendation.lines[0]  # type: ignore[union-attr]
    assert sorted((a.supplier_id, a.packs) for a in line.allocations) == [
        ("sup_bramblewood", 4),
        ("sup_meadowlark", 4),
    ]
    assert line.purchased_quantity == "288" and line.overbuy_quantity == "0"
    assert "no single supplier has enough in stock" in text(r)


def test_04_minimum_order_rules_out_the_cheap_supplier(catalog: Catalog) -> None:
    r = run(catalog, "scn_04_minimum_invalidates_cheap_supplier")
    assert used_suppliers(r) == ["sup_citrusrow"]
    assert "Kestrel" in text(r) and "below its $400.00 minimum" in text(r)


def test_05_delivery_day_changes_the_answer(catalog: Catalog) -> None:
    saturday = run(catalog, "scn_05_delivery_day_changes_answer")
    wednesday = run(catalog, "scn_05_delivery_day_changes_answer", delivery_date="2026-11-11")
    assert used_suppliers(saturday) == ["sup_pelican"]
    assert used_suppliers(wednesday) == ["sup_kestrel"]
    assert wednesday.recommendation.total_cents < saturday.recommendation.total_cents  # type: ignore[union-attr]
    assert any(e.supplier_id == "sup_kestrel" and e.reasons[0].code == "weekday" for e in saturday.excluded_offers)


def test_06_pack_sizes_are_compared_per_egg(catalog: Catalog) -> None:
    r = run(catalog, "scn_06_pack_size_normalization")
    eggs = next(line for line in r.recommendation.lines if line.product_id == "prd_eggs_large")  # type: ignore[union-attr]
    assert eggs.unit == "each" and eggs.purchased_quantity == "360" and eggs.overbuy_quantity == "0"
    assert [(a.supplier_id, a.packs, a.pack_quantity, a.pack_unit) for a in eggs.allocations] == [
        ("sup_meadowlark", 2, "15", "dozen")
    ]


def test_07_sunday_is_infeasible_with_reasons(catalog: Catalog) -> None:
    r = run(catalog, "scn_07_no_feasible_solution")
    assert r.status == "infeasible" and r.recommendation is None and r.savings_cents is None
    by_product = {p.product_id: p for p in r.problems}
    assert set(by_product) == {"prd_flour_ww", "prd_flour_cake"}
    cake = by_product["prd_flour_cake"].message
    assert "Sundays" in cake and "delivers Tue, Thu, Sat" in cake and "delivers Mon, Wed, Fri" in cake


def test_08_stale_offers_are_excluded_and_flagged(catalog: Catalog) -> None:
    r = run(catalog, "scn_08_stale_data_flagged")
    flags = {e.offer_id: [x.code for x in e.reasons] for e in r.excluded_offers}
    assert flags["ofr_pwc_70010"] == ["stale_price"]
    assert flags["ofr_cr_blu_12"] == ["stale_inventory"]
    used_offers = {a.offer_id for s in r.recommendation.suppliers for a in s.allocations}  # type: ignore[union-attr]
    assert not used_offers & {"ofr_pwc_70010", "ofr_cr_blu_12"}
    assert "never use out-of-date prices or stock" in text(r)
