"""POST /v1/optimize, end to end: eligibility -> CP-SAT -> alternatives -> baseline -> words.

Every number in the response comes from the solver's chosen packs and the buyer's own
prices. Savings are only reported against a baseline we could actually price.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction

from .catalog import Catalog, get_catalog
from .eligibility import WEEKDAY_SHORT, Candidate, Eligibility, assess, now_for
from .models import (
    Allocation,
    Alternative,
    Baseline,
    DataSource,
    ExcludedOffer,
    OptimizeRequest,
    OptimizeResponse,
    Plan,
    PlanLine,
    Problem,
    SupplierOrder,
)
from .solver import Pick, Solution, solve
from .units import UnitTable

# ------------------------------------------------------------------------------- formatting


def money(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    return f"{sign}${abs(cents) / 100:,.2f}"


def qty(value: Fraction) -> str:
    """Display quantity: 3 decimal places max, trailing zeros dropped."""
    d = (Decimal(value.numerator) / Decimal(value.denominator)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    s = format(d.normalize(), "f")
    return "0" if s in ("-0", "0") else s


def unit_label(code: str) -> str:
    return "fl oz" if code == "fl_oz" else code


def join(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


# ------------------------------------------------------------------------------------ plans


class Context:
    def __init__(self, catalog: Catalog, request: OptimizeRequest) -> None:
        self.catalog = catalog
        self.request = request
        self.units = UnitTable(catalog.units)
        self.products = {p.id: p for p in catalog.products}
        self.suppliers = {s.id: s for s in catalog.suppliers}

    def product_name(self, pid: str) -> str:
        return self.products[pid].name

    def supplier_name(self, sid: str) -> str:
        return self.suppliers[sid].short_name


def _allocation(p: Pick) -> Allocation:
    o = p.candidate.offer
    return Allocation(
        offer_id=o.id,
        supplier_id=o.supplier_id,
        product_id=o.product_id,
        packs=p.packs,
        pack_label=o.pack.label,
        pack_quantity=o.pack.quantity,
        pack_unit=o.pack.unit,
        pack_price_cents=p.step.price_cents,
        price_basis=p.step.basis,
        line_total_cents=p.cost_cents,
    )


def to_plan(ctx: Context, sol: Solution) -> Plan:
    picks = sorted(sol.picks, key=lambda p: (p.candidate.line_index, p.candidate.supplier.id, p.candidate.offer.id))
    suppliers = []
    for sc in sol.suppliers:
        s = ctx.suppliers[sc.supplier_id]
        mine = [p for p in picks if p.candidate.supplier.id == s.id]
        suppliers.append(
            SupplierOrder(
                supplier_id=s.id,
                supplier_name=s.name,
                items_subtotal_cents=sc.items_cents,
                delivery_fee_cents=sc.fee_cents,
                fee_waived=sc.fee_waived,
                list_delivery_fee_cents=s.policy.delivery_fee_cents,
                free_delivery_threshold_cents=s.policy.free_delivery_threshold_cents,
                min_order_cents=s.policy.min_order_cents,
                order_by=mine[0].candidate.order_by,
                allocations=[_allocation(p) for p in mine],
            )
        )
    lines = []
    for i, line in enumerate(ctx.request.lines):
        mine = [p for p in picks if p.candidate.line_index == i]
        bought = sum((p.packs * p.candidate.pack_base for p in mine), Fraction(0))
        unit_base = Fraction(ctx.units.get(line.unit).to_base)
        purchased = bought / unit_base
        requested = Fraction(line.quantity)
        lines.append(
            PlanLine(
                product_id=line.product_id,
                requested_quantity=line.quantity,
                unit=line.unit,
                purchased_quantity=qty(purchased),
                overbuy_quantity=qty(purchased - requested),
                allocations=[_allocation(p) for p in mine],
            )
        )
    return Plan(
        total_cents=sol.total_cents,
        items_subtotal_cents=sol.items_cents,
        fees_cents=sol.total_cents - sol.items_cents,
        supplier_count=len(sol.suppliers),
        suppliers=suppliers,
        lines=lines,
    )


# ----------------------------------------------------------------------------- alternatives


def alternatives(ctx: Context, elig: Eligibility, best: Solution, preferred: frozenset[str]) -> list[Alternative]:
    out: list[Alternative] = []
    seen = {best.signature()}
    names = ctx.supplier_name

    def add(kind: str, title: str, sol: Solution | None, tradeoff: str) -> None:
        if sol is None or sol.signature() in seen:
            return
        seen.add(sol.signature())
        out.append(
            Alternative(
                kind=kind,
                title=title,
                plan=to_plan(ctx, sol),
                delta_cents=sol.total_cents - best.total_cents,
                tradeoff=tradeoff,
            )
        )

    fewest = solve(elig.candidates, elig.need_base, mode="suppliers", preferred=preferred)
    if fewest and len(fewest.suppliers) < len(best.suppliers):
        add(
            "fewest_suppliers",
            f"Fewest suppliers ({len(fewest.suppliers)})",
            fewest,
            f"{len(best.suppliers) - len(fewest.suppliers)} fewer deliveries to receive, "
            f"for {money(fewest.total_cents - best.total_cents)} more.",
        )

    if preferred:
        only_pref = [c for c in elig.candidates if c.supplier.id in preferred]
        sol = solve(only_pref, elig.need_base, mode="total", preferred=preferred)
        pref_names = join(sorted(names(s) for s in preferred))
        if sol is not None:
            add(
                "preferred_suppliers",
                f"Only your preferred suppliers ({pref_names})",
                sol,
                f"Keeps the order with {pref_names}, for {money(sol.total_cents - best.total_cents)} more.",
            )

    cheapest_items = solve(elig.candidates, elig.need_base, mode="items", preferred=preferred)
    if cheapest_items and cheapest_items.items_cents < best.items_cents:
        add(
            "lowest_item_subtotal",
            "Lowest item prices",
            cheapest_items,
            f"Items cost {money(best.items_cents - cheapest_items.items_cents)} less, but delivery fees "
            f"come to {money(cheapest_items.total_cents - cheapest_items.items_cents)}, so the delivered total "
            f"is {money(cheapest_items.total_cents - best.total_cents)} more.",
        )
    return out


# --------------------------------------------------------------------------------- baseline


def price_baseline(ctx: Context, catalog: Catalog, request: OptimizeRequest, now: datetime) -> Baseline | None:
    if request.baseline is None:
        return None
    habit = {b.product_id: b.supplier_id for b in request.baseline.lines}
    missing = [line.product_id for line in request.lines if line.product_id not in habit]
    if missing:
        return Baseline(
            status="unavailable",
            plan=None,
            reason=f"No usual supplier for {join([ctx.product_name(p) for p in missing[:3]])}"
            + (f" and {len(missing) - 3} more" if len(missing) > 3 else "")
            + ", so there's nothing to compare against.",
        )
    elig = assess(catalog, request, now, only=habit)
    for i, line in enumerate(request.lines):
        if any(c.line_index == i for c in elig.candidates):
            continue
        sid = habit[line.product_id]
        why = next((e.reasons[0].message for e in elig.excluded if e.product_id == line.product_id), None)
        detail = f": {why}" if why else " (they don't sell it)"
        return Baseline(
            status="unavailable",
            plan=None,
            reason=f"Your usual supplier for {ctx.product_name(line.product_id)}, {ctx.supplier_name(sid)}, "
            f"can't supply it for this date{detail}. No savings are shown without a real baseline.",
        )
    sol = solve(elig.candidates, elig.need_base, mode="total")
    if sol is None:
        return Baseline(
            status="unavailable",
            plan=None,
            reason="Your usual suppliers can't fill this order on this date (stock or minimum order). "
            "No savings are shown without a real baseline.",
        )
    return Baseline(status="priced", plan=to_plan(ctx, sol), reason=None)


# ----------------------------------------------------------------------------- explanations


def _line_cost_alone(c: Candidate, need: Fraction) -> int:
    """Cost of covering a line from one offer alone, ignoring stock (an optimistic estimate)."""
    packs = max(c.min_packs, math.ceil(need / c.pack_base))
    return packs * min(s.price_cents for s in c.schedule if s.min_packs <= packs)


def explain(
    ctx: Context, elig: Eligibility, best: Solution, alts: list[Alternative], excluded: list[ExcludedOffer]
) -> list[str]:
    out: list[str] = []
    plan_suppliers = [s.supplier_id for s in best.suppliers]
    fees = best.total_cents - best.items_cents
    who = join([ctx.supplier_name(s) for s in plan_suppliers])
    count = f"{len(plan_suppliers)} supplier{'s' if len(plan_suppliers) != 1 else ''}"
    fee_text = f"including {money(fees)} in delivery fees" if fees else "with free delivery"
    out.append(f"Lowest delivered total: {money(best.total_cents)} from {count} ({who}), {fee_text}.")

    # Why the per-item cheapest supplier for a line isn't used.
    told: set[str] = set()
    for i, line in enumerate(ctx.request.lines):
        cands = [c for c in elig.candidates if c.line_index == i]
        if not cands:
            continue
        cheapest = min(cands, key=lambda c: (Fraction(c.schedule[0].price_cents) / c.pack_base, c.offer.id))
        sid = cheapest.supplier.id
        if sid in plan_suppliers or sid in told:
            continue
        told.add(sid)
        policy = cheapest.supplier.policy
        lines_there = [
            min((c for c in elig.candidates if c.line_index == j and c.supplier.id == sid), key=lambda c: c.offer.id)
            for j in range(len(ctx.request.lines))
            if any(c.line_index == j and c.supplier.id == sid for c in elig.candidates)
        ]
        reachable = sum(_line_cost_alone(c, elig.need_base[c.line_index]) for c in lines_there)
        name = ctx.supplier_name(sid)
        product = ctx.product_name(line.product_id)
        if reachable < policy.min_order_cents:
            out.append(
                f"{name} has the lowest per-item price on {product}, but this order would come to about "
                f"{money(reachable)} there, below its {money(policy.min_order_cents)} minimum."
            )
        else:
            out.append(
                f"{name} has the lowest per-item price on {product}, but once its "
                f"{money(policy.delivery_fee_cents)} delivery fee is added it costs more delivered."
            )

    for sc in best.suppliers:
        s = ctx.suppliers[sc.supplier_id]
        threshold = s.policy.free_delivery_threshold_cents
        if sc.fee_waived and threshold is not None:
            out.append(f"{s.short_name}: delivery is free because the order reaches its {money(threshold)} threshold.")
        elif threshold is not None:
            out.append(
                f"{s.short_name} charges {money(sc.fee_cents)} for delivery "
                f"(free from {money(threshold)}; this order is {money(threshold - sc.items_cents)} short)."
            )

    for i, line in enumerate(ctx.request.lines):
        picks = [p for p in best.picks if p.candidate.line_index == i]
        sup = sorted({p.candidate.supplier.id for p in picks})
        if len(sup) > 1:
            alone_ok = any(
                c.stock_packs * c.pack_base >= elig.need_base[i] for c in elig.candidates if c.line_index == i
            )
            why = "it's cheaper that way" if alone_ok else "no single supplier has enough in stock"
            out.append(
                f"{ctx.product_name(line.product_id)} is split across {join([ctx.supplier_name(s) for s in sup])}: "
                f"{why}."
            )
        for p in picks:
            if p.candidate.offer.product_id != line.product_id:
                out.append(
                    f"Using {ctx.product_name(p.candidate.offer.product_id)} for "
                    f"{ctx.product_name(line.product_id)}, an equivalent you approved."
                )
        bought = sum((p.packs * p.candidate.pack_base for p in picks), Fraction(0))
        over = bought - elig.need_base[i]
        if over > 0:
            unit_base = Fraction(ctx.units.get(line.unit).to_base)
            out.append(
                f"Pack sizes round {ctx.product_name(line.product_id)} up to "
                f"{qty(bought / unit_base)} {unit_label(line.unit)} ({qty(over / unit_base)} more than you asked)."
            )

    flagged = [
        e for e in excluded if any(r.code in ("stale_price", "stale_inventory", "missing_inventory") for r in e.reasons)
    ]
    for e in flagged[:4]:
        reason = next(r for r in e.reasons if r.code in ("stale_price", "stale_inventory", "missing_inventory"))
        out.append(
            f"Left out {ctx.supplier_name(e.supplier_id)}'s {ctx.product_name(e.product_id)}: "
            f"{reason.message[0]}{reason.message[1:]}. We never use out-of-date prices or stock."
        )
    if not best.proven_optimal:
        out.append("This is the best plan found within the time limit; it may not be the absolute lowest.")
    return out


# ---------------------------------------------------------------------------- infeasibility


def explain_infeasible(ctx: Context, elig: Eligibility, excluded: list[ExcludedOffer]) -> list[Problem]:
    problems: list[Problem] = []
    req = ctx.request
    weekday = WEEKDAY_SHORT[date.fromisoformat(req.delivery_date).isoweekday()]

    for i, line in enumerate(req.lines):
        name = ctx.product_name(line.product_id)
        cands = [c for c in elig.candidates if c.line_index == i]
        if not cands:
            offers = [e for e in excluded if e.product_id == line.product_id]
            if not offers:
                problems.append(
                    Problem(
                        scope="line",
                        product_id=line.product_id,
                        code="not_sold",
                        message=f"No participating supplier sells {name}.",
                    )
                )
                continue
            detail = "; ".join(
                f"{ctx.supplier_name(e.supplier_id)}: {', '.join(r.message for r in e.reasons)}" for e in offers
            )
            problems.append(
                Problem(
                    scope="line",
                    product_id=line.product_id,
                    code="no_eligible_offer",
                    message=f"No supplier can deliver {name} on {weekday} {req.delivery_date}. {detail}.",
                )
            )
            continue
        available = sum((c.stock_packs * c.pack_base for c in cands), Fraction(0))
        if available < elig.need_base[i]:
            unit_base = Fraction(ctx.units.get(line.unit).to_base)
            problems.append(
                Problem(
                    scope="line",
                    product_id=line.product_id,
                    code="insufficient_stock",
                    message=f"Only {qty(available / unit_base)} {unit_label(line.unit)} of {name} is in stock across "
                    f"suppliers that can deliver (you asked for {line.quantity}).",
                )
            )
    if problems:
        return problems

    # Every line could be covered on its own: minimum orders must be what's blocking.
    reach: dict[str, int] = {}
    for c in elig.candidates:
        packs = min(c.stock_packs, max(c.min_packs, math.ceil(elig.need_base[c.line_index] / c.pack_base)))
        reach[c.supplier.id] = reach.get(c.supplier.id, 0) + packs * max(s.price_cents for s in c.schedule)
    blocked = {sid for sid, cents in reach.items() if cents < ctx.suppliers[sid].policy.min_order_cents}
    for sid in sorted(blocked):
        s = ctx.suppliers[sid]
        problems.append(
            Problem(
                scope="supplier",
                supplier_id=sid,
                code="minimum_unreachable",
                message=f"{s.short_name}'s {money(s.policy.min_order_cents)} minimum can't be reached with this order "
                f"(at most about {money(reach[sid])}).",
            )
        )
    for i, line in enumerate(req.lines):
        sids = {c.supplier.id for c in elig.candidates if c.line_index == i}
        if sids and sids <= blocked:
            problems.append(
                Problem(
                    scope="line",
                    product_id=line.product_id,
                    code="only_below_minimum",
                    message=f"{ctx.product_name(line.product_id)} is only available from "
                    f"{join([ctx.supplier_name(s) for s in sorted(sids)])}, and this order can't reach their minimum.",
                )
            )
    if not problems:
        problems.append(
            Problem(
                scope="order",
                code="no_combination",
                message="No combination of suppliers meets every stock limit and minimum order for this date.",
            )
        )
    return problems


# ------------------------------------------------------------------------------------- main


def _dedupe(excluded: list[ExcludedOffer]) -> list[ExcludedOffer]:
    seen: dict[str, ExcludedOffer] = {}
    for e in excluded:
        seen.setdefault(e.offer_id, e)
    return sorted(seen.values(), key=lambda e: (e.product_id, e.supplier_id))


def optimize(request: OptimizeRequest, catalog: Catalog | None = None, now: datetime | None = None) -> OptimizeResponse:
    catalog = catalog or get_catalog()
    now = now or now_for(catalog)
    ctx = Context(catalog, request)
    elig = assess(catalog, request, now)
    excluded = _dedupe(elig.excluded)
    preferred = frozenset(request.preferences.preferred_supplier_ids)
    baseline = price_baseline(ctx, catalog, request, now)
    data = DataSource(
        dataset=catalog.meta.dataset, synthetic=catalog.meta.synthetic, label=catalog.meta.label, as_of=now
    )

    best = solve(elig.candidates, elig.need_base, mode="total", preferred=preferred)
    if best is None:
        problems = explain_infeasible(ctx, elig, excluded)
        return OptimizeResponse(
            status="infeasible",
            delivery_date=request.delivery_date,
            zone=request.zone,
            recommendation=None,
            alternatives=[],
            baseline=baseline,
            savings_cents=None,
            explanations=["No plan can fill this order as asked. " + problems[0].message],
            problems=problems,
            excluded_offers=excluded,
            data=data,
        )

    alts = alternatives(ctx, elig, best, preferred)
    explanations = explain(ctx, elig, best, alts, excluded)
    savings = None
    if baseline is not None and baseline.plan is not None:
        savings = baseline.plan.total_cents - best.total_cents
        if savings > 0:
            explanations.insert(
                1, f"That's {money(savings)} less than your usual suppliers ({money(baseline.plan.total_cents)})."
            )
        elif savings == 0:
            explanations.insert(1, "Your usual suppliers are already the cheapest for this order.")
        else:
            explanations.insert(
                1,
                f"Your usual suppliers would be {money(-savings)} cheaper, but your supplier exclusions rule them out.",
            )
    elif baseline is not None and baseline.reason:
        explanations.insert(1, baseline.reason)

    return OptimizeResponse(
        status="optimal",
        delivery_date=request.delivery_date,
        zone=request.zone,
        recommendation=to_plan(ctx, best),
        alternatives=alts,
        baseline=baseline,
        savings_cents=savings,
        explanations=explanations,
        problems=[],
        excluded_offers=excluded,
        data=data,
    )
