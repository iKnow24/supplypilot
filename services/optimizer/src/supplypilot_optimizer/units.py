"""Exact unit conversion.

Every quantity becomes a `Fraction` of its base unit (grams, milliliters or
each). Fractions never round, so "50 lb" is exactly 22679.6185 g and the
optimizer can compare a 50 lb bag with a 25 kg bag without float drift.
"""

from __future__ import annotations

from fractions import Fraction

from .catalog import Unit


class UnitError(ValueError):
    pass


class UnitTable:
    def __init__(self, units: list[Unit]) -> None:
        self._units = {u.code: u for u in units}

    def get(self, code: str) -> Unit:
        try:
            return self._units[code]
        except KeyError:
            raise UnitError(f"Unknown unit {code!r}") from None

    def to_base(self, quantity: str | Fraction | int, unit: str) -> Fraction:
        """Convert a quantity in `unit` to its base unit, exactly."""
        q = Fraction(quantity) if not isinstance(quantity, Fraction) else quantity
        if q < 0:
            raise UnitError("Quantity cannot be negative")
        return q * Fraction(self.get(unit).to_base)

    def convert(self, quantity: str | Fraction | int, from_unit: str, to_unit: str) -> Fraction:
        a, b = self.get(from_unit), self.get(to_unit)
        if a.dimension != b.dimension:
            raise UnitError(f"Cannot convert {a.label} ({a.dimension}) to {b.label} ({b.dimension})")
        return self.to_base(quantity, from_unit) / Fraction(b.to_base)
