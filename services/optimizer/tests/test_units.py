from fractions import Fraction

import pytest

from supplypilot_optimizer.catalog import load_catalog
from supplypilot_optimizer.units import UnitError, UnitTable


@pytest.fixture(scope="module")
def units() -> UnitTable:
    return UnitTable(load_catalog().units)


def test_pounds_to_grams_is_exact(units: UnitTable) -> None:
    assert units.to_base("50", "lb") == Fraction("22679.6185")


def test_dozen_to_each(units: UnitTable) -> None:
    assert units.to_base("15", "dozen") == 180


def test_round_trip_has_no_drift(units: UnitTable) -> None:
    assert units.convert(units.convert("3", "gal", "ml"), "ml", "gal") == 3
    assert units.convert("16", "oz", "lb") == 1


def test_cross_dimension_rejected(units: UnitTable) -> None:
    with pytest.raises(UnitError, match="Cannot convert"):
        units.convert("1", "lb", "gal")


def test_unknown_and_negative_rejected(units: UnitTable) -> None:
    with pytest.raises(UnitError):
        units.to_base("1", "bushel")
    with pytest.raises(UnitError):
        units.to_base("-1", "lb")
