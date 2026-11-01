import numpy as np
import pytest

from ewsim.physics import (
    norm,
    unit,
    launch_speed,
    gravity_vector,
    drag_acceleration,
    atmosphere_density,
    rk4_step,
)


def test_vector_norm():
    assert norm(np.array([3.0, 4.0, 0.0])) == 5.0


def test_unit_vector():
    result = unit(np.array([3.0, 4.0, 0.0]))

    assert np.allclose(result, [0.6, 0.8, 0.0])


def test_zero_vector_normalization():
    assert np.allclose(unit(np.zeros(3)), np.zeros(3))


def test_launch_profile():
    assert launch_speed(0, 100, 20, 1) == 0
    assert launch_speed(2, 100, 20, 1) == 40
    assert launch_speed(7, 100, 20, 1) == 100


def test_gravity_negative_z():
    gravity = gravity_vector()

    assert gravity[0] == 0
    assert gravity[1] == 0
    assert gravity[2] < 0


def test_configurable_gravity():
    gravity = gravity_vector(5.0)

    assert np.allclose(gravity, [0.0, 0.0, -5.0])


def test_drag_opposes_velocity():
    acceleration = drag_acceleration(
        np.array([100.0, 0.0, 0.0]),
        1.2,
        0.3,
        0.03,
        30.0,
    )

    assert acceleration[0] < 0
    assert acceleration[1] == 0
    assert acceleration[2] == 0


def test_zero_velocity_has_no_drag():
    acceleration = drag_acceleration(
        np.zeros(3),
        1.2,
        0.3,
        0.03,
        30.0,
    )

    assert np.allclose(acceleration, np.zeros(3))


def test_atmosphere_density_decreases_with_altitude():
    sea_level = atmosphere_density(0, 1.225)
    high_altitude = atmosphere_density(10000, 1.225)

    assert sea_level == pytest.approx(1.225)
    assert high_altitude < sea_level


def test_rk4_exponential_decay():
    # dy/dt = -y, with exact solution y(t) = exp(-t).
    def derivative(state):
        return -state

    state = np.array([1.0])
    dt = 0.01

    for _ in range(100):
        state = rk4_step(state, derivative, dt)

    assert state[0] == pytest.approx(np.exp(-1.0), rel=1e-7)


def test_invalid_mass_is_rejected():
    with pytest.raises(ValueError):
        drag_acceleration(
            np.array([10.0, 0.0, 0.0]),
            1.2,
            0.3,
            0.03,
            0.0,
        )


def test_invalid_timestep_is_rejected():
    with pytest.raises(ValueError):
        rk4_step(
            np.array([1.0]),
            lambda state: -state,
            0.0,
        )