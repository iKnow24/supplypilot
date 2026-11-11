import json
from copy import deepcopy

import pytest
from pydantic import ValidationError

from supplypilot_optimizer.catalog import Catalog, catalog_path, load_catalog


@pytest.fixture(scope="module")
def raw() -> dict:
    return json.loads(catalog_path().read_text())


def test_seed_catalog_is_valid() -> None:
    c = load_catalog()
    assert 3 <= len(c.suppliers) <= 5
    assert 3 <= len(c.buyers) <= 4
    assert 30 <= len(c.products) <= 60
    assert len(c.scenarios) == 8


def test_everything_is_labelled_synthetic() -> None:
    c = load_catalog()
    assert c.meta.synthetic and "not live" in c.meta.label
    assert all(s.synthetic and s.name.endswith("(Demo)") for s in c.suppliers)
    assert all(b.synthetic and b.name.endswith("(Demo)") for b in c.buyers)
    assert all(o.synthetic and o.source.type == "synthetic_seed" for o in c.offers)


def test_spec_scenarios_have_their_ingredients() -> None:
    c = load_catalog()
    now, policy = c.meta.reference_now, c.meta.freshness_policy

    def age_h(t):  # type: ignore[no-untyped-def]
        return (now - t).total_seconds() / 3600

    stale_price = [o for o in c.offers if age_h(o.price_updated_at) > policy.price_max_age_hours]
    stale_stock = [o for o in c.offers if o.inventory and age_h(o.inventory.as_of) > policy.inventory_max_age_hours]
    missing_stock = [o for o in c.offers if o.inventory is None]
    assert stale_price and stale_stock and missing_stock
    assert any(o.price_tiers for o in c.offers)
    assert any(o.min_packs > 1 for o in c.offers)
    # Same product sold in different pack units (eggs: dozen-based cases vs flats)
    assert len({o.pack.quantity for o in c.offers if o.product_id == "prd_eggs_large"}) == 3


def test_contract_prices_are_per_buyer() -> None:
    c = load_catalog()
    by_buyer = {b.id: {(p.supplier_id, p.product_id) for p in b.contract_prices} for b in c.buyers}
    assert by_buyer["org_sundaycrumb"] != by_buyer["org_thirdshift"]


def test_integrity_errors_are_reported(raw: dict) -> None:
    bad = deepcopy(raw)
    bad["offers"][0]["product_id"] = "prd_does_not_exist"
    with pytest.raises(ValidationError, match="unknown product"):
        Catalog.model_validate(bad)


def test_unit_dimension_mismatch_rejected(raw: dict) -> None:
    bad = deepcopy(raw)
    bad["buyers"][0]["saved_lists"][0]["lines"][0]["unit"] = "gal"  # flour by the gallon
    with pytest.raises(ValidationError, match="does not measure"):
        Catalog.model_validate(bad)


def test_unknown_fields_rejected(raw: dict) -> None:
    bad = deepcopy(raw)
    bad["suppliers"][0]["secret_rebate"] = 5
    with pytest.raises(ValidationError):
        Catalog.model_validate(bad)


def test_catalog_path_prefers_the_env_var(monkeypatch, tmp_path) -> None:  # type: ignore[no-untyped-def]
    from supplypilot_optimizer.catalog import catalog_path

    monkeypatch.delenv("SUPPLYPILOT_CATALOG_PATH", raising=False)
    assert catalog_path().name == "demo_catalog.json" and catalog_path().is_file()
    monkeypatch.setenv("SUPPLYPILOT_CATALOG_PATH", str(tmp_path / "other.json"))
    assert catalog_path() == tmp_path / "other.json"
