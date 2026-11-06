"""Request/response contract for POST /v1/optimize.

This is the frontend/backend boundary (docs/api-contract.md). The web app generates its
TypeScript types from the OpenAPI schema FastAPI builds from these models, so nobody
hand-copies them.

Conventions: money is integer cents; quantities are decimal strings (exact on the way in,
rounded to 3 places for display on the way out — the math in between uses Fractions);
dates are local YYYY-MM-DD in the market's time zone.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ------------------------------------------------------------------------------------ request


class RequestLine(Strict):
    product_id: str
    quantity: str = Field(description="Positive decimal string, e.g. '250' or '2.5'")
    unit: str = Field(description="Unit code from the catalog, e.g. 'lb', 'dozen', 'fl_oz'")

    @field_validator("quantity")
    @classmethod
    def _positive_decimal(cls, v: str) -> str:
        try:
            d = Decimal(v)
        except InvalidOperation:
            raise ValueError("quantity must be a decimal string") from None
        if not d.is_finite() or d <= 0:
            raise ValueError("quantity must be positive")
        if d > 100_000:
            raise ValueError("quantity is too large")
        return v


class Preferences(Strict):
    excluded_supplier_ids: list[str] = Field(default_factory=list)
    preferred_supplier_ids: list[str] = Field(default_factory=list)
    allow_equivalences: bool = Field(
        default=True,
        description="Use equivalent products only where the buyer has approved that equivalence.",
    )

    @model_validator(mode="after")
    def _disjoint(self) -> Preferences:
        if set(self.excluded_supplier_ids) & set(self.preferred_supplier_ids):
            raise ValueError("a supplier can't be both preferred and excluded")
        return self


class BaselineLine(Strict):
    product_id: str
    supplier_id: str


class BaselineRequest(Strict):
    """The buyer's habit: which supplier they usually buy each line from."""

    lines: list[BaselineLine]


class OptimizeRequest(Strict):
    buyer_id: str
    zone: str
    delivery_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    lines: list[RequestLine] = Field(min_length=1, max_length=200)
    preferences: Preferences = Field(default_factory=Preferences)
    baseline: BaselineRequest | None = None

    @model_validator(mode="after")
    def _unique_products(self) -> OptimizeRequest:
        ids = [line.product_id for line in self.lines]
        if len(ids) != len(set(ids)):
            raise ValueError("each product may appear only once")
        return self


# ----------------------------------------------------------------------------------- response

ExclusionCode = Literal[
    "excluded_by_buyer",
    "zone",
    "weekday",
    "cutoff_passed",
    "stale_price",
    "stale_inventory",
    "missing_inventory",
    "out_of_stock",
    "unreviewed_mapping",
    "equivalence_not_approved",
]


class Reason(Strict):
    code: ExclusionCode
    message: str


class ExcludedOffer(Strict):
    offer_id: str
    supplier_id: str
    product_id: str
    reasons: list[Reason]


class Allocation(Strict):
    """Packs bought from one offer for one requested line."""

    offer_id: str
    supplier_id: str
    product_id: str = Field(description="The product actually bought (may be an approved equivalent)")
    packs: int
    pack_label: str
    pack_quantity: str
    pack_unit: str
    pack_price_cents: int
    price_basis: Literal["contract", "list", "volume_tier"]
    line_total_cents: int


class PlanLine(Strict):
    product_id: str = Field(description="The product the buyer asked for")
    requested_quantity: str
    unit: str
    purchased_quantity: str = Field(description="What the packs add up to, in the requested unit (3 dp)")
    overbuy_quantity: str = Field(description="purchased - requested, in the requested unit (3 dp)")
    allocations: list[Allocation]


class SupplierOrder(Strict):
    supplier_id: str
    supplier_name: str
    items_subtotal_cents: int
    delivery_fee_cents: int = Field(description="Fee actually charged (0 if waived)")
    fee_waived: bool
    list_delivery_fee_cents: int
    free_delivery_threshold_cents: int | None
    min_order_cents: int
    order_by: OrderBy
    allocations: list[Allocation]


class OrderBy(Strict):
    date: str
    time: str


class Plan(Strict):
    total_cents: int
    items_subtotal_cents: int
    fees_cents: int
    supplier_count: int
    suppliers: list[SupplierOrder]
    lines: list[PlanLine]


class Alternative(Strict):
    kind: Literal["fewest_suppliers", "preferred_suppliers", "lowest_item_subtotal"]
    title: str
    plan: Plan
    delta_cents: int = Field(description="This plan's total minus the recommendation's (>= 0)")
    tradeoff: str


class Baseline(Strict):
    status: Literal["priced", "unavailable"]
    plan: Plan | None
    reason: str | None = Field(description="Why there's no baseline price, when unavailable")


class Problem(Strict):
    """Why no plan exists, at the most specific scope we can name."""

    scope: Literal["line", "supplier", "order"]
    product_id: str | None = None
    supplier_id: str | None = None
    code: str
    message: str


class DataSource(Strict):
    dataset: str
    synthetic: bool
    label: str
    as_of: datetime = Field(description="The 'now' used for cutoffs and freshness")


class OptimizeResponse(Strict):
    status: Literal["optimal", "infeasible"]
    delivery_date: str
    zone: str
    recommendation: Plan | None
    alternatives: list[Alternative]
    baseline: Baseline | None = Field(description="Null when the request had no baseline")
    savings_cents: int | None = Field(
        description="Baseline total minus recommendation total. Only set when the baseline was priced."
    )
    explanations: list[str]
    problems: list[Problem]
    excluded_offers: list[ExcludedOffer]
    data: DataSource


SupplierOrder.model_rebuild()
