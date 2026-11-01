import pytest

from ewsim.config import load_config
from ewsim.world import ProceduralWorld, MAX_LAYER


@pytest.fixture
def world():
    return ProceduralWorld(load_config())


def test_huge_layer_is_exact_integer(world):
    layer = 10**100

    assert world.validate_layer(layer) == MAX_LAYER
    assert world.layer_difference(layer, layer - 1) == 1


def test_layer_outside_valid_range_is_rejected(world):
    with pytest.raises(ValueError):
        world.validate_layer(-1)

    with pytest.raises(ValueError):
        world.validate_layer(MAX_LAYER + 1)


def test_lazy_civilization_generation_is_deterministic(world):
    first = world.civilization(1, 2, 3)
    second = world.civilization(1, 2, 3)

    assert first == second


def test_civilization_defense_is_consistent(world):
    first = world.civilization(1, 2, 3)
    second = world.civilization(4, 5, 6)

    assert first.defense == second.defense == 1.0


def test_cell_center_coordinates(world):
    assert world.cell_center_xy(0, 0) == (0.5, 0.5)
    assert world.cell_center_xy(4, 9) == (4.5, 9.5)


def test_invalid_cell_coordinates_are_rejected(world):
    with pytest.raises(ValueError):
        world.cell_center_xy(-1, 0)

    with pytest.raises(ValueError):
        world.cell_center_xy(0, world.na)


def test_y_only_hostility_match(world):
    # World width is 100 and tolerance is 0.5.
    assert world.hostility_match(4.0, 4.2)
    assert world.hostility_match(4.0, 54.0)
    assert not world.hostility_match(4.0, 55.0)
    assert not world.hostility_match(4.0, 60.0)


def test_nearby_layer_sampling_stays_in_bounds(world):
    import numpy as np

    rng = np.random.default_rng(1234)

    for _ in range(100):
        layer = world.sample_layer_near(
            MAX_LAYER,
            3,
            rng,
        )

        assert 0 <= layer <= MAX_LAYER


def test_negative_layer_delta_is_rejected(world):
    import numpy as np

    rng = np.random.default_rng(1234)

    with pytest.raises(ValueError):
        world.sample_layer_near(10, -1, rng)