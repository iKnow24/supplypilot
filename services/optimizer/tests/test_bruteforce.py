"""Cross-check CP-SAT against exhaustive enumeration on random small baskets.

The brute force shares only eligibility (which offers are usable and at what price schedule)
with the solver. Coverage, stock, minimum packs, tiers, minimum orders and fees are
re-implemented here independently, straight from the business rules:

  * whole packs; an offer is either unused or bought at least `min_packs` times
  * per-pack price = the lowest price step whose min_packs the pack count reaches
  * we never buy more packs than covering the line needs, except to reach a volume tier
  * a used supplier's item subtotal must reach its minimum order
  * its delivery fee is charged unless the subtotal reaches the free-delivery threshold
  * a line that isn't fully covered is left out and buys nothing; the best plan fills as many
    lines as possible, then has the lowest total (a "partial" plan when some are left out)
"""

from __future__ import annotations

import itertools
import math
import random
from datetime import date, timedelta
from fractions import Fraction

from conftest import scenario_request

from supplypilot_optimizer.catalog import Catalog
from supplypilot_optimizer.eligibility import Candidate, assess, now_for
from supplypilot_optimizer.optimize import optimize

MAX_COMBOS = 40_000


class TooBig(Exception):
    pass


def _price(c: Candidate, packs: int) -> int:
    return min(s.price_cents for s in c.schedule if s.min_packs <= packs)


def brute_force(candidates: list[Candidate], need: list[Fraction]) -> tuple[int, int] | None:
    """(lines left out, total cents) of the best plan, or None if no line can be filled."""
    options: list[list[int]] = []
    for c in candidates:
        top = max(max(s.min_packs for s in c.schedule), c.min_packs, math.ceil(need[c.line_index] / c.pack_base))
        options.append([0, *range(c.min_packs, min(c.stock_packs, top) + 1)])
    if math.prod(len(o) for o in options) > MAX_COMBOS:
        raise TooBig
    best: tuple[int, int] | None = None
    for combo in itertools.product(*options):
        covered = [Fraction(0)] * len(need)
        bought = [0] * len(need)
        per_offer: dict[str, int] = {}
        for c, k in zip(candidates, combo, strict=True):
            covered[c.line_index] += k * c.pack_base
            bought[c.line_index] += k
            per_offer[c.offer.id] = per_offer.get(c.offer.id, 0) + k
        left_out = [i for i, (cov, n) in enumerate(zip(covered, need, strict=True)) if cov < n]
        if any(bought[i] for i in left_out) or len(left_out) == len(need):
            continue
        if any(per_offer[c.offer.id] > c.stock_packs for c in candidates):
            continue
        subtotal: dict[str, int] = {}
        for c, k in zip(candidates, combo, strict=True):
            if k:
                subtotal[c.supplier.id] = subtotal.get(c.supplier.id, 0) + k * _price(c, k)
        total = 0
        ok = True
        for sid, items in subtotal.items():
            policy = next(c.supplier.policy for c in candidates if c.supplier.id == sid)
            if items < policy.min_order_cents:
                ok = False
                break
            free = policy.free_delivery_threshold_cents is not None and items >= policy.free_delivery_threshold_cents
            total += items + (0 if free else policy.delivery_fee_cents)
        if ok and (best is None or (len(left_out), total) < best):
            best = (len(left_out), total)
    return best


def test_solver_matches_brute_force_on_random_baskets(catalog: Catalog) -> None:
    rng = random.Random(20261106)
    units = {u.code: u for u in catalog.units}
    start = date.fromisoformat("2026-11-06")
    now = now_for(catalog)
    compared = feasible = partial = 0
    for _ in range(400):
        buyer = rng.choice(catalog.buyers)
        products = rng.sample(catalog.products, rng.randint(1, 3))
        lines = []
        for p in products:
            offer = next((o for o in catalog.offers if o.product_id == p.id), None)
            if offer is None:
                continue
            # 0.1 .. 3 packs of one of its offers, expressed in the product's default unit (3 dp).
            pack = Fraction(offer.pack.quantity) * Fraction(units[offer.pack.unit].to_base)
            quantity = pack * Fraction(rng.randint(1, 30), 10) / Fraction(units[p.default_unit].to_base)
            lines.append({"product_id": p.id, "quantity": f"{max(float(quantity), 0.001):.3f}", "unit": p.default_unit})
        if not lines:
            continue
        req = scenario_request(
            catalog,
            "scn_01_cheap_items_not_cheap_basket",
            buyer_id=buyer.id,
            zone=buyer.locations[0].zone,
            delivery_date=(start + timedelta(days=rng.randint(0, 6))).isoformat(),
            lines=lines,
        )
        elig = assess(catalog, req, now)
        try:
            expected = brute_force(elig.candidates, elig.need_base)
        except TooBig:
            continue
        r = optimize(req, catalog, now)
        got = (len(lines) - len(r.recommendation.lines), r.recommendation.total_cents) if r.recommendation else None
        assert got == expected, f"{req.model_dump()} solver={got} brute={expected}"
        assert r.status == ("infeasible" if got is None else "partial" if got[0] else "optimal")
        compared += 1
        feasible += got is not None and got[0] == 0
        partial += got is not None and got[0] > 0
    print(f"compared {compared} baskets with brute force: {feasible} full, {partial} partial")
    assert compared >= 60, compared
    assert feasible >= 30, feasible
    assert partial >= 10, partial
    assert compared - feasible - partial >= 5, "want some fully infeasible baskets too"
