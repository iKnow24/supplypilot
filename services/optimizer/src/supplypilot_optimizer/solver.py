"""CP-SAT model for the total-delivered-cost basket problem.

Decision: how many whole packs to buy from each eligible offer for each requested line.

Constraints
  * coverage   — per line, the packs bought add up to at least what was asked (exact: pack
                 sizes and needs are Fractions scaled to integers per line)
  * stock      — never more packs than the supplier's (fresh) stock count
  * min packs  — an offer bought at all is bought at least `min_packs` times
  * tiers      — all-units volume pricing: the pack count picks one price step
  * minimum    — a supplier used at all must reach its minimum order (item subtotal)
  * fees       — each supplier used charges its delivery fee unless the item subtotal reaches
                 its free-delivery threshold

Objective (integer cents), then deterministic lexicographic tie-breaks, each solved with the
previous objectives pinned: fewer suppliers -> fewer non-preferred suppliers -> fewer packs
-> a fixed offer order. One worker + a fixed seed, so the same input gives the same answer.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

from ortools.sat.python import cp_model

from .eligibility import Candidate, PriceStep

Mode = Literal["total", "items", "suppliers"]
TIME_LIMIT_S = 10.0


@dataclass(frozen=True)
class Pick:
    candidate: Candidate
    packs: int
    step: PriceStep

    @property
    def cost_cents(self) -> int:
        return self.packs * self.step.price_cents


@dataclass(frozen=True)
class SupplierCost:
    supplier_id: str
    items_cents: int
    fee_cents: int
    fee_waived: bool


@dataclass(frozen=True)
class Solution:
    picks: list[Pick]
    suppliers: list[SupplierCost]
    proven_optimal: bool

    @property
    def total_cents(self) -> int:
        return sum(s.items_cents + s.fee_cents for s in self.suppliers)

    @property
    def items_cents(self) -> int:
        return sum(s.items_cents for s in self.suppliers)

    def signature(self) -> tuple[tuple[str, int, int], ...]:
        return tuple(sorted((p.candidate.offer.id, p.candidate.line_index, p.packs) for p in self.picks))


def _scale(values: list[Fraction]) -> tuple[list[int], int]:
    """Scale fractions to integers with one common factor, then divide out their gcd."""
    denom = math.lcm(*(v.denominator for v in values))
    ints = [int(v * denom) for v in values]
    g = math.gcd(*ints) or 1
    return [i // g for i in ints], g


def solve(
    candidates: list[Candidate],
    need_base: list[Fraction],
    *,
    mode: Mode = "total",
    preferred: frozenset[str] = frozenset(),
) -> Solution | None:
    """Best plan for the given candidates, or None if no plan satisfies every constraint."""
    m = cp_model.CpModel()
    by_line: dict[int, list[int]] = {i: [] for i in range(len(need_base))}
    for ci, c in enumerate(candidates):
        by_line[c.line_index].append(ci)
    if any(not cs for cs in by_line.values()):
        return None

    # --- packs per candidate, split into price steps (all-units tiers)
    n: list[cp_model.IntVar] = []
    ubs: list[int] = []
    cost: list[cp_model.LinearExprT] = []
    step_vars: list[list[tuple[PriceStep, cp_model.IntVar, cp_model.IntVar]]] = []
    for ci, c in enumerate(candidates):
        useful = math.ceil(need_base[c.line_index] / c.pack_base)
        top_tier = max(s.min_packs for s in c.schedule)
        ub = min(c.stock_packs, max(useful, top_tier, c.min_packs))
        nv = m.new_int_var(0, ub, f"n_{ci}")
        ubs.append(ub)
        parts = []
        for k, step in enumerate(c.schedule):
            lo = step.min_packs
            hi = ub if k + 1 == len(c.schedule) else min(ub, c.schedule[k + 1].min_packs - 1)
            on = m.new_bool_var(f"on_{ci}_{k}")
            mk = m.new_int_var(0, ub, f"m_{ci}_{k}")
            if lo > hi:
                m.add(on == 0)
            m.add(mk >= lo * on)
            m.add(mk <= hi * on)
            parts.append((step, on, mk))
        m.add_at_most_one(on for _, on, _ in parts)
        m.add(nv == sum(mk for _, _, mk in parts))
        n.append(nv)
        step_vars.append(parts)
        cost.append(
            cp_model.LinearExpr.weighted_sum([mk for _, _, mk in parts], [st.price_cents for st, _, _ in parts])
        )

    # --- coverage per line (exact)
    for line, cis in by_line.items():
        ints, _ = _scale([need_base[line], *(candidates[ci].pack_base for ci in cis)])
        rhs, coefs = ints[0], ints[1:]
        m.add(sum(coef * n[ci] for coef, ci in zip(coefs, cis, strict=True)) >= rhs)

    # --- stock is per offer, shared if one offer could fill two lines
    by_offer: dict[str, list[int]] = {}
    for ci, c in enumerate(candidates):
        by_offer.setdefault(c.offer.id, []).append(ci)
    for cis in by_offer.values():
        if len(cis) > 1:
            m.add(sum(n[ci] for ci in cis) <= candidates[cis[0]].stock_packs)

    # --- suppliers: used, minimum order, delivery fee
    by_supplier: dict[str, list[int]] = {}
    for ci, c in enumerate(candidates):
        by_supplier.setdefault(c.supplier.id, []).append(ci)
    used: dict[str, cp_model.IntVar] = {}
    items: dict[str, cp_model.LinearExprT] = {}
    fee_on: dict[str, cp_model.IntVar] = {}
    for sid, cis in sorted(by_supplier.items()):
        policy = candidates[cis[0]].supplier.policy
        y = m.new_bool_var(f"used_{sid}")
        for ci in cis:
            m.add(n[ci] <= ubs[ci] * y)
        m.add(sum(n[ci] for ci in cis) >= y)
        subtotal = cp_model.LinearExpr.sum([cost[ci] for ci in cis])
        m.add(subtotal >= policy.min_order_cents * y)
        f = m.new_bool_var(f"fee_{sid}")
        if policy.free_delivery_threshold_cents is None:
            m.add(f == y)
        else:
            free = m.new_bool_var(f"free_{sid}")
            m.add(free <= y)
            m.add(subtotal >= policy.free_delivery_threshold_cents * free)
            m.add(f >= y - free)
            m.add(f <= y)
        used[sid], items[sid], fee_on[sid] = y, subtotal, f

    LE = cp_model.LinearExpr
    items_total = LE.sum(list(items.values()))
    fees_total = cp_model.LinearExpr.weighted_sum(
        [fee_on[sid] for sid in by_supplier],
        [candidates[cis[0]].supplier.policy.delivery_fee_cents for cis in by_supplier.values()],
    )
    total = LE.sum([items_total, fees_total])
    supplier_count = LE.sum(list(used.values()))
    non_preferred = LE.sum([y for sid, y in used.items() if sid not in preferred])
    packs = LE.sum(n)
    order_rank = {oid: r for r, oid in enumerate(sorted(by_offer))}
    stable = LE.weighted_sum(n, [order_rank[c.offer.id] for c in candidates])

    objectives: list[cp_model.LinearExpr] = {
        "total": [total, supplier_count, non_preferred, packs, stable],
        "items": [items_total, total, supplier_count, non_preferred, packs, stable],
        "suppliers": [supplier_count, total, non_preferred, packs, stable],
    }[mode]

    solver = cp_model.CpSolver()
    solver.parameters.num_workers = 1
    solver.parameters.random_seed = 0
    solver.parameters.max_time_in_seconds = TIME_LIMIT_S

    tracked: list[cp_model.IntVar] = [*n, *used.values(), *fee_on.values()]
    tracked += [v for parts in step_vars for _, on, mk in parts for v in (on, mk)]
    snapshot: dict[int, int] | None = None
    proven = True
    for phase, objective in enumerate(objectives):
        m.minimize(objective)
        status = solver.solve(m)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            if phase == 0:
                return None
            break  # keep the previous phase's answer (time limit; not expected at this size)
        proven = proven and status == cp_model.OPTIMAL
        snapshot = {v.index: solver.value(v) for v in tracked}
        m.clear_hints()  # type: ignore[no-untyped-call]
        for v in tracked:
            m.add_hint(v, snapshot[v.index])
        m.add(objective <= round(solver.objective_value))
    assert snapshot is not None
    final = snapshot

    def val(v: cp_model.IntVar) -> int:
        return final[v.index]

    picks: list[Pick] = []
    for ci, c in enumerate(candidates):
        for step, on, mk in step_vars[ci]:
            if val(on) and val(mk) > 0:
                picks.append(Pick(c, val(mk), step))
    costs = []
    for sid, cis in sorted(by_supplier.items()):
        if not val(used[sid]):
            continue
        policy = candidates[cis[0]].supplier.policy
        charged = bool(val(fee_on[sid]))
        costs.append(
            SupplierCost(
                supplier_id=sid,
                items_cents=sum(p.cost_cents for p in picks if p.candidate.supplier.id == sid),
                fee_cents=policy.delivery_fee_cents if charged else 0,
                fee_waived=not charged,
            )
        )
    return Solution(picks=picks, suppliers=costs, proven_optimal=proven)
