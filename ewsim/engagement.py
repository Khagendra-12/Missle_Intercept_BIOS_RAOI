from __future__ import annotations

import math
import numpy as np

from .physics import (
    drag_acceleration,
    atmosphere_density,
    gravity_vector,
    launch_speed,
    norm,
)
from .guidance import apn_acceleration
from .rng import keyed_rng


def _limit_speed(velocity: np.ndarray, maximum: float) -> np.ndarray:
    """Limit velocity magnitude without changing its direction."""
    speed = norm(velocity)

    if speed > maximum and speed > 0.0:
        return velocity * (maximum / speed)

    return velocity


def simulate_engagement(
    cfg: dict,
    world,
    weather,
    run_index: int,
    layer: int | None = None,
) -> dict:
    w = cfg["world"]
    p = cfg["physics"]
    s = cfg["simulation"]

    rng = keyed_rng(
        s["seed"],
        "engagement",
        run_index,
        layer if layer is not None else "base",
    )

    na = int(w["na"])

    if na <= 0:
        raise ValueError("World dimension must be positive.")

    dt = float(p["dt_s"])
    max_time = float(s["max_time_s"])

    if dt <= 0 or max_time <= 0:
        raise ValueError("Simulation timestep and maximum time must be positive.")

    # Select the local launch and target cells.
    oi = int(rng.integers(0, na))
    oj = int(rng.integers(0, na))
    ti = int(rng.integers(0, na))
    tj = int(rng.integers(0, na))

    base_layer = (
        int(rng.integers(0, 10**6))
        if layer is None
        else world.validate_layer(layer)
    )

    max_separation = int(w["max_layer_separation"])

    if max_separation < 0:
        raise ValueError("Maximum layer separation cannot be negative.")

    layer_offset = int(
        rng.integers(-max_separation, max_separation + 1)
    )

    target_layer = max(
        0,
        min(10**100, base_layer + layer_offset),
    )

    ox, oy = world.cell_center_xy(oi, oj)
    tx, ty = world.cell_center_xy(ti, tj)

    dz_layers = world.layer_difference(target_layer, base_layer)

    if abs(dz_layers) > max_separation:
        return {
            "run": run_index,
            "status": "infeasible",
            "reason": "layer separation",
            "layer": str(base_layer),
            "target_layer": str(target_layer),
        }

    # Convert kilometres to metres.
    launch_position = np.array(
        [ox * 1000.0, oy * 1000.0, 0.0],
        dtype=float,
    )

    target_position = np.array(
        [
            tx * 1000.0,
            ty * 1000.0,
            dz_layers * 1000.0,
        ],
        dtype=float,
    )

    target_vector = target_position - launch_position
    target_distance = norm(target_vector)

    maximum_range = float(w["max_missile_range_km"]) * 1000.0

    if target_distance > maximum_range:
        return {
            "run": run_index,
            "status": "out_of_range",
            "distance_km": target_distance / 1000.0,
            "layer": str(base_layer),
            "target_layer": str(target_layer),
        }

    direction = target_vector / max(target_distance, 1e-9)

    # Both vehicles start at the launch point.
    missile_position = launch_position.copy()
    interceptor_position = launch_position.copy()

    missile_velocity = np.zeros(3, dtype=float)
    interceptor_velocity = np.zeros(3, dtype=float)

    target_velocity = np.zeros(3, dtype=float)

    trajectory = []

    time_s = 0.0
    closest_distance = float("inf")
    detected = False

    interception_radius = float(p["interception_radius_m"])

    missile_max_speed = float(p["missile_max_speed_m_s"])
    interceptor_max_speed = float(p["interceptor_max_speed_m_s"])

    missile_acceleration = float(p["missile_accel_m_s2"])
    interceptor_acceleration = float(p["interceptor_accel_m_s2"])

    def make_result(status: str, **extra) -> dict:
        result = {
            "run": run_index,
            "status": status,
            "time_s": time_s,
            "closest_m": closest_distance,
            "distance_km": target_distance / 1000.0,
            "layer": str(base_layer),
            "target_layer": str(target_layer),
            "trajectory": trajectory,
        }
        result.update(extra)
        return result

    while time_s < max_time:
        separation = norm(
            interceptor_position - missile_position
        )

        closest_distance = min(
            closest_distance,
            separation,
        )

        # Do not count the shared launch position as an interception.
        if time_s > 0.0 and separation <= interception_radius:
            return make_result(
                "intercepted",
                closest_m=separation,
            )

        trajectory.append({
            "timeS": time_s,
            "missile": {
                "xKm": float(missile_position[0] / 1000.0),
                "yKm": float(missile_position[1] / 1000.0),
                "layer": str(base_layer),
                "velocityMps": norm(missile_velocity),
                "headingDeg": math.degrees(
                    math.atan2(
                        missile_velocity[1],
                        missile_velocity[0],
                    )
                ),
                "accelerationMps2": missile_acceleration,
                "status": "IN FLIGHT",
            },
            "interceptor": {
                "xKm": float(interceptor_position[0] / 1000.0),
                "yKm": float(interceptor_position[1] / 1000.0),
                "layer": str(base_layer),
                "velocityMps": norm(interceptor_velocity),
                "headingDeg": math.degrees(
                    math.atan2(
                        interceptor_velocity[1],
                        interceptor_velocity[0],
                    )
                ),
                "accelerationMps2": interceptor_acceleration,
                "status": "TRACKING",
            },
            "separationM": separation,
        })

        # Sample weather lazily at the current missile position.
        missile_weather = weather.sample(
            missile_position[0] / 1000.0,
            missile_position[1] / 1000.0,
            base_layer,
        )

        detection_range = (
            float(p["detection_range_km"])
            * 1000.0
            * max(
                0.3,
                1.0 - abs(missile_weather["grf"]) * 0.03,
            )
        )

        detected = detected or separation <= detection_range

        # Interceptor guidance.
        if detected:
            interceptor_command = apn_acceleration(
                interceptor_position,
                interceptor_velocity,
                missile_position,
                missile_velocity,
            )
        else:
            interceptor_command = (
                direction * interceptor_acceleration
            )

        # Missile acceleration profile.
        missile_speed_target = launch_speed(
            time_s,
            missile_max_speed,
            missile_acceleration,
            float(p["missile_hold_s"]),
        )

        if norm(missile_velocity) < missile_speed_target:
            missile_command = direction * missile_acceleration
        else:
            missile_command = np.zeros(3, dtype=float)

        # Interceptor acceleration profile.
        interceptor_speed_target = launch_speed(
            time_s,
            interceptor_max_speed,
            interceptor_acceleration,
            float(p["interceptor_hold_s"]),
        )

        if norm(interceptor_velocity) >= interceptor_speed_target:
            interceptor_command = np.zeros(3, dtype=float)

        # Missile aerodynamic forces.
        missile_relative_wind = (
            missile_velocity
            - np.asarray(missile_weather["wind_m_s"], dtype=float)
        )

        missile_density = atmosphere_density(
            missile_position[2],
            missile_weather["density_kg_m3"],
        )

        missile_drag = drag_acceleration(
            missile_relative_wind,
            missile_density,
            p["drag_coefficient"],
            p["area_m2"],
            p["mass_kg"],
        )

        missile_total_acceleration = (
            missile_command
            + missile_drag
            + gravity_vector()
        )

        # Interceptor aerodynamic forces.
        interceptor_weather = weather.sample(
            interceptor_position[0] / 1000.0,
            interceptor_position[1] / 1000.0,
            base_layer,
        )

        interceptor_relative_wind = (
            interceptor_velocity
            - np.asarray(interceptor_weather["wind_m_s"], dtype=float)
        )

        interceptor_density = atmosphere_density(
            interceptor_position[2],
            interceptor_weather["density_kg_m3"],
        )

        interceptor_drag = drag_acceleration(
            interceptor_relative_wind,
            interceptor_density,
            p["drag_coefficient"],
            p["area_m2"],
            p["mass_kg"],
        )

        interceptor_total_acceleration = (
            interceptor_command
            + interceptor_drag
            + gravity_vector()
        )

        # Semi-implicit Euler integration.
        missile_velocity += missile_total_acceleration * dt
        interceptor_velocity += interceptor_total_acceleration * dt

        missile_velocity = _limit_speed(
            missile_velocity,
            missile_max_speed,
        )

        interceptor_velocity = _limit_speed(
            interceptor_velocity,
            interceptor_max_speed,
        )

        missile_position += missile_velocity * dt
        interceptor_position += interceptor_velocity * dt

        time_s += dt

        # Missile range boundary.
        travelled_distance = norm(
            missile_position - launch_position
        )

        if travelled_distance > maximum_range:
            return make_result("missile_out_of_bounds")

        # Ground impact.
        if missile_position[2] < 0.0 or interceptor_position[2] < 0.0:
            return make_result("ground_impact")

        # Target impact.
        if norm(missile_position - target_position) <= interception_radius:
            return make_result("target_hit")

    # Reaching the time limit is not a successful interception.
    return make_result("timeout")