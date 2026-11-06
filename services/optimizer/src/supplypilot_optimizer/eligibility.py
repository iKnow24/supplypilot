"""Which offers may be used for a request, and why the others can't.

Everything here is deterministic and explainable: an offer is either a Candidate (with its
exact pack size and the buyer's price schedule) or an ExcludedOffer with every reason that
applies. The delivery rules mirror apps/web/src/lib/delivery.ts (same messages, same cases).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from fractions import Fraction
from zoneinfo import ZoneInfo

from .catalog import BuyerOrganization, Catalog, DeliveryPolicy, Supplier, SupplierOffer
from .models import ExcludedOffer, OptimizeRequest, OrderBy, Reason
from .units import UnitTable

WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WEEKDAY_LONG = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ------------------------------------------------------------------------------------ delivery


@dataclass(frozen=True)
class DeliveryCheck:
    ok: bool
    reason: Reason | None = None
    order_by: OrderBy | None = None


def check_delivery(policy: DeliveryPolicy, zone: str, day: date, now: datetime, tz: str) -> DeliveryCheck:
    """Can this supplier deliver to `zone` on local date `day`, ordering at `now`?"""
    if zone not in policy.zones:
        return DeliveryCheck(False, Reason(code="zone", message="Does not deliver to your area"))
    weekday = day.isoweekday()
    if weekday not in policy.delivery_weekdays:
        days = ", ".join(WEEKDAY_SHORT[d] for d in sorted(policy.delivery_weekdays))
        return DeliveryCheck(
            False,
            Reason(code="weekday", message=f"Doesn't deliver on {WEEKDAY_LONG[weekday]}s (delivers {days})"),
        )
    order_by_date = day - timedelta(days=policy.lead_days)
    local_now = now.astimezone(ZoneInfo(tz))
    local = (local_now.date().isoformat(), local_now.strftime("%H:%M"))
    if local > (order_by_date.isoformat(), policy.cutoff_local_time):
        return DeliveryCheck(False, Reason(code="cutoff_passed", message="Order cutoff has passed"))
    return DeliveryCheck(True, order_by=OrderBy(date=order_by_date.isoformat(), time=policy.cutoff_local_time))


# ------------------------------------------------------------------------------------- pricing


@dataclass(frozen=True)
class PriceStep:
    """From `min_packs` packs upward, every pack costs `price_cents` (all-units pricing)."""

    min_packs: int
    price_cents: int
    basis: str  # "contract" | "list" | "volume_tier"


def price_schedule(offer: SupplierOffer, contract_cents: int | None) -> list[PriceStep]:
    """The buyer's per-pack price as a function of pack count.

    Rule: the buyer pays the LOWEST of their contract price, the list price, and any volume
    tier they qualify for. A tier never makes a pack more expensive than the contract.
    """
    if contract_cents is not None and contract_cents <= offer.list_price_cents:
        base = PriceStep(offer.min_packs, contract_cents, "contract")
    else:
        base = PriceStep(offer.min_packs, offer.list_price_cents, "list")
    steps = [base]
    for tier in sorted(offer.price_tiers, key=lambda t: t.min_packs):
        if tier.price_cents < steps[-1].price_cents and tier.min_packs > base.min_packs:
            steps.append(PriceStep(tier.min_packs, tier.price_cents, "volume_tier"))
    return steps


# ---------------------------------------------------------------------------------- candidates


@dataclass(frozen=True)
class Candidate:
    offer: SupplierOffer
    supplier: Supplier
    line_index: int
    pack_base: Fraction  # one pack, in the product's base unit (g / ml / each)
    min_packs: int
    stock_packs: int
    schedule: list[PriceStep]
    order_by: OrderBy


@dataclass
class Eligibility:
    candidates: list[Candidate] = field(default_factory=list)
    excluded: list[ExcludedOffer] = field(default_factory=list)
    need_base: list[Fraction] = field(default_factory=list)  # per request line


class RequestError(ValueError):
    """The request refers to something that doesn't exist (bad id, unit, date...)."""


def now_for(catalog: Catalog) -> datetime:
    """Synthetic data runs on its fixed demo clock; real data on the real one."""
    return catalog.meta.reference_now if catalog.meta.synthetic else datetime.now(ZoneInfo(catalog.meta.timezone))


def _equivalents(catalog: Catalog, buyer: BuyerOrganization, product_id: str, allow: bool) -> dict[str, bool]:
    """Products that could fill this line -> whether the buyer approved using them."""
    out: dict[str, bool] = {product_id: True}
    for eq in catalog.equivalences:
        if product_id in eq.product_ids:
            approved = allow and (eq.id in buyer.approved_equivalences or not eq.requires_buyer_approval)
            for p in eq.product_ids:
                if p != product_id:
                    out[p] = out.get(p, False) or approved
    return out


def assess(
    catalog: Catalog,
    request: OptimizeRequest,
    now: datetime,
    *,
    only: dict[str, str] | None = None,
) -> Eligibility:
    """Split every relevant offer into usable candidates and excluded offers.

    `only` (product_id -> supplier_id) restricts each line to one supplier's offer for exactly
    that product: used to cost the buyer's baseline habit. Buyer exclusions don't apply there.
    """
    units = UnitTable(catalog.units)
    buyer = next((b for b in catalog.buyers if b.id == request.buyer_id), None)
    if buyer is None:
        raise RequestError(f"Unknown buyer {request.buyer_id!r}")
    if request.zone not in {z.id for z in catalog.zones}:
        raise RequestError(f"Unknown zone {request.zone!r}")
    try:
        day = date.fromisoformat(request.delivery_date)
    except ValueError:
        raise RequestError(f"Invalid delivery date {request.delivery_date!r}") from None
    known_suppliers = {s.id for s in catalog.suppliers}
    for s in [*request.preferences.excluded_supplier_ids, *request.preferences.preferred_supplier_ids]:
        if s not in known_suppliers:
            raise RequestError(f"Unknown supplier {s!r}")

    products = {p.id: p for p in catalog.products}
    suppliers = {s.id: s for s in catalog.suppliers}
    contract = {(c.supplier_id, c.product_id): c.price_cents for c in buyer.contract_prices}
    policy = catalog.meta.freshness_policy
    excluded_by_buyer = set(request.preferences.excluded_supplier_ids) if only is None else set()
    delivery = {
        s.id: check_delivery(s.policy, request.zone, day, now, catalog.meta.timezone) for s in catalog.suppliers
    }

    result = Eligibility()
    for i, line in enumerate(request.lines):
        product = products.get(line.product_id)
        if product is None:
            raise RequestError(f"Unknown product {line.product_id!r}")
        unit = units.get(line.unit)
        if unit.base_unit != product.base_unit:
            raise RequestError(f"{product.name} can't be measured in {unit.label}")
        result.need_base.append(units.to_base(line.quantity, line.unit))

        if only is not None:
            options = {line.product_id: True}
        else:
            options = _equivalents(catalog, buyer, line.product_id, request.preferences.allow_equivalences)

        for offer in catalog.offers:
            if offer.product_id not in options:
                continue
            if only is not None and offer.supplier_id != only.get(line.product_id):
                continue
            supplier = suppliers[offer.supplier_id]
            reasons: list[Reason] = []
            if not options[offer.product_id]:
                reasons.append(
                    Reason(
                        code="equivalence_not_approved",
                        message=f"{products[offer.product_id].name} is an equivalent you haven't approved",
                    )
                )
            if supplier.id in excluded_by_buyer:
                reasons.append(Reason(code="excluded_by_buyer", message="You excluded this supplier"))
            d = delivery[supplier.id]
            if not d.ok and d.reason:
                reasons.append(d.reason)
            if not (offer.mapping.reviewed or offer.mapping.method == "supplier_provided"):
                reasons.append(Reason(code="unreviewed_mapping", message="Product match not yet reviewed"))
            price_age = now - offer.price_updated_at
            if price_age > timedelta(hours=policy.price_max_age_hours):
                reasons.append(
                    Reason(
                        code="stale_price",
                        message=f"Price is {price_age.days} days old (limit {policy.price_max_age_hours // 24})",
                    )
                )
            if offer.inventory is None:
                reasons.append(Reason(code="missing_inventory", message="No stock count"))
            else:
                stock_age = now - offer.inventory.as_of
                if stock_age > timedelta(hours=policy.inventory_max_age_hours):
                    hours = int(stock_age.total_seconds() // 3600)
                    reasons.append(
                        Reason(
                            code="stale_inventory",
                            message=f"Stock count is {hours} hours old (limit {policy.inventory_max_age_hours})",
                        )
                    )
                elif offer.inventory.packs_available < offer.min_packs:
                    reasons.append(Reason(code="out_of_stock", message="Out of stock"))

            if reasons:
                result.excluded.append(
                    ExcludedOffer(
                        offer_id=offer.id, supplier_id=supplier.id, product_id=offer.product_id, reasons=reasons
                    )
                )
                continue
            assert offer.inventory is not None and d.order_by is not None
            result.candidates.append(
                Candidate(
                    offer=offer,
                    supplier=supplier,
                    line_index=i,
                    pack_base=units.to_base(offer.pack.quantity, offer.pack.unit),
                    min_packs=offer.min_packs,
                    stock_packs=offer.inventory.packs_available,
                    schedule=price_schedule(offer, contract.get((supplier.id, offer.product_id))),
                    order_by=d.order_by,
                )
            )
    return result
