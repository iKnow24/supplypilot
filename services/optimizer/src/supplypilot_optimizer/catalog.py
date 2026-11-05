"""Typed catalog contract.

These Pydantic models describe the shared catalog format in
`data/seed/demo_catalog.json`. The web app validates the same file with a zod
schema (apps/web/src/lib/catalog/schema.ts). If you change a field here,
change it there too: `docs/api-contract.md` explains the boundary.

Money is always integer cents. Quantities are exact decimal strings so we can
turn them into `Fraction`s without float rounding.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Dimension = Literal["mass", "volume", "count"]
BaseUnit = Literal["g", "ml", "each"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


def _check_decimal(v: str) -> str:
    d = Decimal(v)  # raises on garbage
    if d <= 0:
        raise ValueError("quantity must be positive")
    return v


class Unit(Strict):
    code: str
    label: str
    dimension: Dimension
    base_unit: BaseUnit
    to_base: str

    _v = field_validator("to_base")(_check_decimal)


class Zone(Strict):
    id: str
    name: str


class TimeWindow(Strict):
    start: str = Field(pattern=r"^\d{2}:\d{2}$")
    end: str = Field(pattern=r"^\d{2}:\d{2}$")


class DeliveryPolicy(Strict):
    zones: list[str]
    delivery_weekdays: list[int] = Field(description="ISO weekdays, 1=Mon .. 7=Sun")
    cutoff_local_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    lead_days: int = Field(ge=0)
    delivery_window: TimeWindow
    min_order_cents: int = Field(ge=0)
    delivery_fee_cents: int = Field(ge=0)
    free_delivery_threshold_cents: int | None = Field(default=None, ge=0)

    @field_validator("delivery_weekdays")
    @classmethod
    def _weekdays(cls, v: list[int]) -> list[int]:
        if not v or any(d < 1 or d > 7 for d in v):
            raise ValueError("weekdays must be ISO 1..7")
        return v


class Supplier(Strict):
    id: str
    name: str
    short_name: str
    kind: str
    description: str
    policy: DeliveryPolicy
    synthetic: bool


class Product(Strict):
    id: str
    name: str
    category: str
    base_unit: BaseUnit
    default_unit: str
    spec: str


class Pack(Strict):
    quantity: str
    unit: str
    label: str

    _v = field_validator("quantity")(_check_decimal)


class PriceTier(Strict):
    min_packs: int = Field(ge=1)
    price_cents: int = Field(ge=0)


class InventorySnapshot(Strict):
    packs_available: int = Field(ge=0)
    as_of: datetime


class OfferMapping(Strict):
    # supplier_provided: the supplier told us which product this is.
    # manual: a person on our side mapped it. ai_suggested: NOT trusted until reviewed.
    method: Literal["supplier_provided", "manual", "ai_suggested"]
    reviewed: bool


class Source(Strict):
    type: Literal["synthetic_seed", "csv_import", "api", "edi", "email"]
    import_id: str


class SupplierOffer(Strict):
    id: str
    supplier_id: str
    product_id: str
    supplier_sku: str
    pack: Pack
    list_price_cents: int = Field(ge=0)
    min_packs: int = Field(ge=1)
    price_tiers: list[PriceTier]
    price_updated_at: datetime
    inventory: InventorySnapshot | None
    mapping: OfferMapping
    source: Source
    synthetic: bool


class ContractPrice(Strict):
    supplier_id: str
    product_id: str
    price_cents: int = Field(ge=0)


class Location(Strict):
    id: str
    name: str
    zone: str
    address_label: str


class SavedListLine(Strict):
    product_id: str
    quantity: str
    unit: str
    current_supplier_id: str | None

    _v = field_validator("quantity")(_check_decimal)


class SavedList(Strict):
    id: str
    name: str
    lines: list[SavedListLine]


class BuyerOrganization(Strict):
    id: str
    name: str
    kind: Literal["bakery", "cafe", "restaurant"]
    synthetic: bool
    locations: list[Location]
    approved_equivalences: list[str]
    contract_prices: list[ContractPrice]
    saved_lists: list[SavedList]


class Equivalence(Strict):
    id: str
    product_ids: list[str] = Field(min_length=2)
    note: str
    requires_buyer_approval: bool


class ScenarioLine(Strict):
    product_id: str
    quantity: str
    unit: str


class Scenario(Strict):
    id: str
    title: str
    buyer_id: str
    zone: str
    delivery_date: str
    compare_delivery_date: str | None = None
    lines: list[ScenarioLine]
    expect: str


class FreshnessPolicy(Strict):
    price_max_age_hours: int
    inventory_max_age_hours: int
    on_stale: Literal["exclude_and_flag"]
    on_missing_inventory: Literal["exclude_and_flag"]


class Meta(Strict):
    dataset: str
    synthetic: bool
    label: str
    currency: Literal["USD"]
    timezone: str
    market: str
    reference_now: datetime
    freshness_policy: FreshnessPolicy


class CatalogImport(Strict):
    id: str
    source_type: str
    description: str
    imported_at: datetime
    supplier_ids: list[str]


class Catalog(Strict):
    meta: Meta
    catalog_imports: list[CatalogImport]
    units: list[Unit]
    zones: list[Zone]
    suppliers: list[Supplier]
    products: list[Product]
    equivalences: list[Equivalence]
    offers: list[SupplierOffer]
    buyers: list[BuyerOrganization]
    scenarios: list[Scenario]

    @model_validator(mode="after")
    def _referential_integrity(self) -> Catalog:
        """Fail loudly if anything points at an id that does not exist."""
        units = {u.code: u for u in self.units}
        zones = {z.id for z in self.zones}
        suppliers = {s.id for s in self.suppliers}
        products = {p.id: p for p in self.products}
        offer_keys = {(o.supplier_id, o.product_id) for o in self.offers}
        equivalences = {e.id for e in self.equivalences}
        errors: list[str] = []

        def unit_ok(where: str, unit: str, product_id: str) -> None:
            if unit not in units:
                errors.append(f"{where}: unknown unit {unit!r}")
            elif product_id in products and units[unit].base_unit != products[product_id].base_unit:
                errors.append(f"{where}: unit {unit!r} does not measure {product_id}")

        for s in self.suppliers:
            errors += [f"{s.id}: unknown zone {z}" for z in s.policy.zones if z not in zones]
        for o in self.offers:
            if o.supplier_id not in suppliers:
                errors.append(f"{o.id}: unknown supplier")
            if o.product_id not in products:
                errors.append(f"{o.id}: unknown product")
            unit_ok(o.id, o.pack.unit, o.product_id)
        for e in self.equivalences:
            errors += [f"{e.id}: unknown product {p}" for p in e.product_ids if p not in products]
        for b in self.buyers:
            errors += [f"{b.id}: unknown zone {loc.zone}" for loc in b.locations if loc.zone not in zones]
            errors += [f"{b.id}: unknown equivalence {e}" for e in b.approved_equivalences if e not in equivalences]
            for c in b.contract_prices:
                if (c.supplier_id, c.product_id) not in offer_keys:
                    errors.append(f"{b.id}: contract price for an offer that does not exist")
            for lst in b.saved_lists:
                for line in lst.lines:
                    if line.product_id not in products:
                        errors.append(f"{lst.id}: unknown product {line.product_id}")
                    unit_ok(lst.id, line.unit, line.product_id)
                    if line.current_supplier_id and (line.current_supplier_id, line.product_id) not in offer_keys:
                        errors.append(f"{lst.id}: baseline supplier does not sell {line.product_id}")
        for sc in self.scenarios:
            for sline in sc.lines:
                unit_ok(sc.id, sline.unit, sline.product_id)
        if errors:
            raise ValueError("catalog integrity errors:\n  " + "\n  ".join(errors))
        return self


REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CATALOG_PATH = REPO_ROOT / "data" / "seed" / "demo_catalog.json"


def catalog_path() -> Path:
    return Path(os.environ.get("SUPPLYPILOT_CATALOG_PATH", DEFAULT_CATALOG_PATH))


def load_catalog(path: Path | None = None) -> Catalog:
    raw = json.loads((path or catalog_path()).read_text(encoding="utf-8"))
    return Catalog.model_validate(raw)


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    return load_catalog()
