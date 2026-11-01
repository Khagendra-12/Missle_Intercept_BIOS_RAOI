from __future__ import annotations

import numpy as np


G = 9.80665


def norm(v) -> float:
    """Return the Euclidean magnitude of a vector."""
    return float(np.linalg.norm(np.asarray(v, dtype=float)))


def unit(v) -> np.ndarray:
    """Return a normalized 3D vector, or zero for a near-zero vector."""
    vector = np.asarray(v, dtype=float)

    if vector.shape != (3,):
        raise ValueError("Expected a three-dimensional vector.")

    magnitude = norm(vector)

    if magnitude <= 1e-12:
        return np.zeros(3, dtype=float)

    return vector / magnitude


def atmosphere_density(
    altitude_m: float,
    weather_density: float,
) -> float:
    """
    Estimate air density using exponential altitude attenuation.

    Weather density is the local surface/reference density.
    """
    altitude_m = float(altitude_m)
    weather_density = float(weather_density)

    if not np.isfinite(altitude_m) or not np.isfinite(weather_density):
        raise ValueError("Altitude and density must be finite.")

    if weather_density < 0:
        raise ValueError("Weather density cannot be negative.")

    scale_height_m = 8500.0

    density = weather_density * np.exp(
        -max(0.0, altitude_m) / scale_height_m
    )

    return max(0.0, float(density))


def drag_acceleration(
    v_rel_m_s,
    rho: float,
    cd: float,
    area: float,
    mass: float,
) -> np.ndarray:
    """
    Calculate aerodynamic drag acceleration.

    Returns acceleration opposite to relative airflow.
    """
    velocity = np.asarray(v_rel_m_s, dtype=float)

    if velocity.shape != (3,):
        raise ValueError("Relative velocity must be a 3D vector.")

    if not np.all(np.isfinite(velocity)):
        raise ValueError("Relative velocity must be finite.")

    rho = float(rho)
    cd = float(cd)
    area = float(area)
    mass = float(mass)

    if not all(np.isfinite(x) for x in (rho, cd, area, mass)):
        raise ValueError("Drag parameters must be finite.")

    if rho < 0 or cd < 0 or area < 0:
        raise ValueError("Density, drag coefficient and area cannot be negative.")

    if mass <= 0:
        raise ValueError("Mass must be greater than zero.")

    speed = norm(velocity)

    if speed < 1e-9:
        return np.zeros(3, dtype=float)

    drag_factor = (
        0.5 * rho * cd * area / mass
    )

    return -drag_factor * speed * velocity


def launch_speed(
    t: float,
    vmax: float,
    accel: float,
    hold_s: float,
) -> float:
    """
    Calculate the commanded launch speed.

    Accelerates linearly until vmax, then holds that speed.
    """
    t = float(t)
    vmax = float(vmax)
    accel = float(accel)
    hold_s = float(hold_s)

    if not all(np.isfinite(x) for x in (t, vmax, accel, hold_s)):
        raise ValueError("Launch parameters must be finite.")

    if vmax < 0:
        raise ValueError("Maximum speed cannot be negative.")

    if accel <= 0:
        raise ValueError("Acceleration must be positive.")

    if hold_s < 0:
        raise ValueError("Hold duration cannot be negative.")

    if t <= 0:
        return 0.0

    acceleration_time = vmax / accel

    if t < acceleration_time:
        return min(vmax, accel * t)

    return vmax


def gravity_vector(gravity_m_s2: float = G) -> np.ndarray:
    """Return the downward gravity acceleration vector."""
    gravity_m_s2 = float(gravity_m_s2)

    if not np.isfinite(gravity_m_s2) or gravity_m_s2 < 0:
        raise ValueError("Gravity must be finite and non-negative.")

    return np.array(
        [0.0, 0.0, -gravity_m_s2],
        dtype=float,
    )


def rk4_step(state, derivative, dt: float) -> np.ndarray:
    """
    Advance a numerical state by one fourth-order Runge-Kutta step.

    The derivative function must accept a state and return
    a derivative with the same shape.
    """
    state = np.asarray(state, dtype=float)
    dt = float(dt)

    if not np.all(np.isfinite(state)):
        raise ValueError("Integration state must be finite.")

    if not np.isfinite(dt) or dt <= 0:
        raise ValueError("Integration timestep must be positive and finite.")

    k1 = np.asarray(derivative(state), dtype=float)
    k2 = np.asarray(derivative(state + 0.5 * dt * k1), dtype=float)
    k3 = np.asarray(derivative(state + 0.5 * dt * k2), dtype=float)
    k4 = np.asarray(derivative(state + dt * k3), dtype=float)

    if any(
        k.shape != state.shape or not np.all(np.isfinite(k))
        for k in (k1, k2, k3, k4)
    ):
        raise ValueError(
            "Derivative must return a finite array matching the state shape."
        )

    return state + (dt / 6.0) * (
        k1 + 2.0 * k2 + 2.0 * k3 + k4
    )