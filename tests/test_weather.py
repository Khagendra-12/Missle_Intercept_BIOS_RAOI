import numpy as np
import pytest

from ewsim.config import load_config
from ewsim.weather import ProceduralGRF


@pytest.fixture
def weather():
    return ProceduralGRF(load_config())


def test_weather_outputs_are_finite(weather):
    result = weather.sample(1.0, 2.0, 10**100)

    assert np.isfinite(result["grf"])
    assert np.isfinite(result["temperature_c"])
    assert np.isfinite(result["density_kg_m3"])

    assert all(
        np.isfinite(component)
        for component in result["wind_m_s"]
    )


def test_weather_is_deterministic(weather):
    first = weather.sample(1.0, 2.0, 10)
    second = weather.sample(1.0, 2.0, 10)

    assert first == second


def test_weather_changes_with_location(weather):
    first = weather.sample(1.0, 2.0, 10)
    second = weather.sample(15.0, 20.0, 10)

    assert first != second


def test_weather_supports_huge_layer_indices(weather):
    result = weather.sample(1.0, 2.0, 10**100)

    assert isinstance(result["temperature_c"], float)
    assert isinstance(result["density_kg_m3"], float)
    assert len(result["wind_m_s"]) == 3


def test_weather_density_is_positive(weather):
    result = weather.sample(1.0, 2.0, 10)

    assert result["density_kg_m3"] > 0.0


def test_weather_wind_has_three_components(weather):
    result = weather.sample(1.0, 2.0, 10)

    assert len(result["wind_m_s"]) == 3


def test_invalid_weather_coordinates_are_rejected(weather):
    with pytest.raises(ValueError):
        weather.sample(float("nan"), 2.0, 10)

    with pytest.raises(ValueError):
        weather.sample(1.0, float("inf"), 10)