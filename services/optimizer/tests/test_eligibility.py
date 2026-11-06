"""Offer eligibility and pricing. Delivery cases mirror apps/web/src/lib/delivery.test.ts."""

from __future__ import annotations

from datetime import date, datetime

import pytest
from conftest import scenario_request

from supplypilot_optimizer.catalog import Catalog, DeliveryPolicy, PriceTier, SupplierOffer, TimeWindow
from supplypilot_optimizer.eligibility import RequestError, assess, check_delivery, price_schedule

TZ = "America/New_York"
NOW = datetime.fromisoformat("2026-11-05T09:00:00-05:00")  # Thu 9:00 AM Orlando
POLICY = DeliveryPolicy(
    zones=["ORL-WP"],
    delivery_weekdays=[2, 4, 6],
    cutoff_local_time="12:00",
    lead_days=1,
    delivery_window=TimeWindow(start="07:00", end="11:00"),
    min_order_cents=25000,
    delivery_fee_cents=2500,
    free_delivery_threshold_cents=50000,
)


def test_delivery_rejects_other_zones() -> None:
    r = check_delivery(POLICY, "ORL-KIS", date(2026, 11, 7), NOW, TZ)
    assert not r.ok and r.reason and r.reason.code == "zone"


def test_delivery_rejects_non_delivery_days_with_the_schedule() -> None:
    r = check_delivery(POLICY, "ORL-WP", date(2026, 11, 8), NOW, TZ)
    assert r.reason and r.reason.code == "weekday"
    assert r.reason.message == "Doesn't deliver on Sundays (delivers Tue, Thu, Sat)"


def test_delivery_cutoff_is_local_time() -> None:
    # Friday delivery needs ordering by Thursday 12:00 local. It's 9:00 -> ok; 12:01 -> too late.
    ok = check_delivery(POLICY, "ORL-WP", date(2026, 11, 6), NOW, TZ)
    assert not ok.ok  # Friday isn't a delivery day for this policy
    sat = check_delivery(POLICY, "ORL-WP", date(2026, 11, 7), NOW, TZ)
    assert sat.ok and sat.order_by and (sat.order_by.date, sat.order_by.time) == ("2026-11-06", "12:00")
    late = datetime.fromisoformat("2026-11-06T12:01:00-05:00")
    assert check_delivery(POLICY, "ORL-WP", date(2026, 11, 7), late, TZ).reason.code == "cutoff_passed"  # type: ignore[union-attr]
    # Same instant expressed in UTC gives the same answer.
    utc = datetime.fromisoformat("2026-11-06T17:01:00+00:00")
    assert not check_delivery(POLICY, "ORL-WP", date(2026, 11, 7), utc, TZ).ok


def _offer(catalog: Catalog, offer_id: str) -> SupplierOffer:
    return next(o for o in catalog.offers if o.id == offer_id)


def test_price_is_the_lowest_of_contract_list_and_tier(catalog: Catalog) -> None:
    flour = _offer(catalog, "ofr_bb_fl_ap50")  # list 28.75, tier 10+ = 27.25
    no_contract = price_schedule(flour, None)
    assert [(s.min_packs, s.price_cents, s.basis) for s in no_contract] == [
        (1, 2875, "list"),
        (10, 2725, "volume_tier"),
    ]
    # Sunday Crumb's contract (26.50) beats the tier, so the tier never applies.
    assert [(s.price_cents, s.basis) for s in price_schedule(flour, 2650)] == [(2650, "contract")]
    # A contract above list price is ignored.
    assert price_schedule(flour, 9999)[0].basis == "list"
    tiered = flour.model_copy(update={"price_tiers": [PriceTier(min_packs=5, price_cents=2800)]})
    assert [s.price_cents for s in price_schedule(tiered, 2850)] == [2850, 2800]


def test_equivalents_only_when_the_buyer_approved(catalog: Catalog) -> None:
    # Beet sugar is only sold by Kestrel, which delivers on Wednesdays.
    line = [{"product_id": "prd_sugar_gran_cane", "quantity": "50", "unit": "lb"}]
    wed = "2026-11-11"
    sunday = assess(
        catalog, scenario_request(catalog, "scn_02_bundle_one_supplier", lines=line, delivery_date=wed), NOW
    )
    assert any(c.offer.product_id == "prd_sugar_gran_beet" for c in sunday.candidates)
    third = assess(
        catalog,
        scenario_request(
            catalog,
            "scn_02_bundle_one_supplier",
            buyer_id="org_thirdshift",
            zone="ORL-UCF",
            lines=line,
            delivery_date=wed,
        ),
        NOW,
    )
    assert not any(c.offer.product_id == "prd_sugar_gran_beet" for c in third.candidates)
    assert any(r.code == "equivalence_not_approved" for e in third.excluded for r in e.reasons)
    off = scenario_request(
        catalog,
        "scn_02_bundle_one_supplier",
        lines=line,
        delivery_date=wed,
        preferences={"allow_equivalences": False},
    )
    assert not any(c.offer.product_id == "prd_sugar_gran_beet" for c in assess(catalog, off, NOW).candidates)


def test_missing_inventory_and_buyer_exclusions_are_reasons(catalog: Catalog) -> None:
    missing = _offer(catalog, "ofr_pwc_50102")
    req = scenario_request(
        catalog,
        "scn_01_cheap_items_not_cheap_basket",
        lines=[{"product_id": missing.product_id, "quantity": "1", "unit": missing.pack.unit}],
        preferences={"excluded_supplier_ids": ["sup_meadowlark"]},
    )
    e = assess(catalog, req, NOW)
    reasons = {x.offer_id: [r.code for r in x.reasons] for x in e.excluded}
    assert "missing_inventory" in reasons["ofr_pwc_50102"]
    assert all(c.supplier.id != "sup_meadowlark" for c in e.candidates)


@pytest.mark.parametrize(
    ("override", "match"),
    [
        ({"buyer_id": "org_nope"}, "Unknown buyer"),
        ({"zone": "ORL-NOPE"}, "Unknown zone"),
        ({"lines": [{"product_id": "prd_nope", "quantity": "1", "unit": "lb"}]}, "Unknown product"),
        ({"lines": [{"product_id": "prd_milk_whole", "quantity": "1", "unit": "lb"}]}, "can't be measured"),
        ({"preferences": {"excluded_supplier_ids": ["sup_nope"]}}, "Unknown supplier"),
    ],
)
def test_bad_references_are_request_errors(catalog: Catalog, override: dict[str, object], match: str) -> None:
    with pytest.raises(RequestError, match=match):
        assess(catalog, scenario_request(catalog, "scn_01_cheap_items_not_cheap_basket", **override), NOW)
