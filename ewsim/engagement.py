
from __future__ import annotations

import math
import numpy as np

from .guidance import apn_acceleration
from .physics import atmosphere_density, drag_acceleration, norm, unit
from .rng import keyed_rng


def simulate_engagement(cfg, world, weather, run_index, layer=None):
    """Run one attacker/missile/interceptor engagement and record its path."""

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
    cell_size_km = float(w.get("cell_size_km", 1.0))

    target_range = w.get("target_range_km", [10.0, 20.0])
    min_range_km = float(target_range[0])
    max_range_km = float(target_range[1])

    min_offset = max(1, math.ceil(min_range_km / cell_size_km))
    max_offset = min(na - 1, math.floor(max_range_km / cell_size_km))

    if min_offset > max_offset:
        return {
            "run": run_index,
            "status": "no_valid_engagement",
            "reason": "World dimensions cannot accommodate target range.",
            "trajectory": [],
        }

    base_layer = (
        world.validate_layer(layer)
        if layer is not None
        else int(rng.integers(0, 1_000_000))
    )

    selected = None

    # Find one hostile attacker and one non-hostile target.
    for _ in range(2000):
        attacker_i = int(rng.integers(0, na - max_offset))
        attacker_j = int(rng.integers(0, na))

        attacker = world.civilization(
            attacker_i, attacker_j, base_layer
        )

        if not attacker.hostile:
            continue

        offsets = list(range(min_offset, max_offset + 1))
        rng.shuffle(offsets)

        for offset in offsets:
            target_i = attacker_i + offset
            target_j = attacker_j

            target = world.civilization(
                target_i, target_j, base_layer
            )

            if target.hostile:
                continue

            attacker_x, attacker_y = world.cell_center_xy(
                attacker_i, attacker_j
            )
            target_x, target_y = world.cell_center_xy(
                target_i, target_j
            )

            distance_km = math.hypot(
                target_x - attacker_x,
                target_y - attacker_y,
            ) * cell_size_km

            if not world.hostility_match(attacker_y, target_y):
                continue

            if min_range_km <= distance_km <= max_range_km:
                selected = (
                    attacker,
                    target,
                    attacker_x * cell_size_km,
                    attacker_y * cell_size_km,
                    target_x * cell_size_km,
                    target_y * cell_size_km,
                    distance_km,
                )
                break

        if selected is not None:
            break

    if selected is None:
        return {
            "run": run_index,
            "status": "no_valid_engagement",
            "reason": "Could not find a valid attacker and target.",
            "layer": str(base_layer),
            "trajectory": [],
        }

    (
        attacker,
        target,
        attacker_x,
        attacker_y,
        target_x,
        target_y,
        initial_distance_km,
    ) = selected

    # All vectors are 3D to match physics.py and guidance.py.
    # The demonstration constrains movement to z = 0.
    missile_position = np.array(
        [attacker_x * 1000.0, attacker_y * 1000.0, 0.0],
        dtype=float,
    )
    target_position = np.array(
        [target_x * 1000.0, target_y * 1000.0, 0.0],
        dtype=float,
    )
    interceptor_position = target_position.copy()

    missile_velocity = np.zeros(3, dtype=float)
    interceptor_velocity = np.zeros(3, dtype=float)

    missile_acceleration = np.zeros(3, dtype=float)
    interceptor_acceleration = np.zeros(3, dtype=float)

    dt = float(p["dt_s"])
    max_time = float(s["max_time_s"])

    if dt <= 0 or max_time <= 0:
        raise ValueError("dt_s and max_time_s must be positive.")

    missile_max_speed = float(p["missile_max_speed_m_s"])
    interceptor_max_speed = float(p["interceptor_max_speed_m_s"])

    missile_accel_limit = float(p["missile_accel_m_s2"])
    interceptor_accel_limit = float(p["interceptor_accel_m_s2"])

    interception_radius = float(p["interception_radius_m"])
    detection_range = float(p["detection_range_km"]) * 1000.0

    trajectory = []
    detected = False
    closest_approach = float("inf")
    next_record_time = 1.0

    def cap_speed(velocity, maximum):
        speed = norm(velocity)
        if speed > maximum and speed > 0:
            return velocity * (maximum / speed)
        return velocity

    def record_state(force=False):
        separation = norm(interceptor_position - missile_position)

        state = {
            "timeS": round(t, 3),
            "missile": {
                "xKm": float(missile_position[0] / 1000.0),
                "yKm": float(missile_position[1] / 1000.0),
                "zKm": float(missile_position[2] / 1000.0),
                "layer": str(base_layer),
                "velocityMps": norm(missile_velocity),
                "headingDeg": math.degrees(
                    math.atan2(
                        missile_velocity[1],
                        missile_velocity[0],
                    )
                ),
                "accelerationMps2": norm(missile_acceleration),
                "status": "IN FLIGHT",
            },
            "interceptor": {
                "xKm": float(interceptor_position[0] / 1000.0),
                "yKm": float(interceptor_position[1] / 1000.0),
                "zKm": float(interceptor_position[2] / 1000.0),
                "layer": str(base_layer),
                "velocityMps": norm(interceptor_velocity),
                "headingDeg": math.degrees(
                    math.atan2(
                        interceptor_velocity[1],
                        interceptor_velocity[0],
                    )
                ),
                "accelerationMps2": norm(interceptor_acceleration),
                "status": "TRACKING" if detected else "WAITING",
            },
            "separationM": float(separation),
        }

        if trajectory and abs(
            trajectory[-1]["timeS"] - state["timeS"]
        ) < 1e-8:
            trajectory[-1] = state
        elif force or not trajectory or t >= next_record_time - 1e-8:
            trajectory.append(state)

    t = 0.0
    final_time = 0.0
    status = "timeout"

    record_state(force=True)

    while t < max_time:
        separation = norm(interceptor_position - missile_position)
        closest_approach = min(closest_approach, separation)

        if separation <= interception_radius:
            status = "intercepted"
            break

        distance_to_target = norm(target_position - missile_position)

        if distance_to_target <= interception_radius:
            status = "target_hit"
            break

        missile_weather = weather.sample(
            missile_position[0] / 1000.0,
            missile_position[1] / 1000.0,
            base_layer,
        )

        interceptor_weather = weather.sample(
            interceptor_position[0] / 1000.0,
            interceptor_position[1] / 1000.0,
            base_layer,
        )

        weather_factor = max(
            0.3,
            1.0 - abs(float(missile_weather["grf"])) * 0.03,
        )

        detected = detected or (
            separation <= detection_range * weather_factor
        )

        # Missile movement toward the target.
        missile_direction = unit(target_position - missile_position)
        missile_acceleration = missile_direction * missile_accel_limit

        missile_wind = np.asarray(
            missile_weather["wind_m_s"],
            dtype=float,
        )

        missile_density = atmosphere_density(
            0.0,
            missile_weather["density_kg_m3"],
        )

        missile_drag = drag_acceleration(
            missile_velocity - missile_wind,
            missile_density,
            p["drag_coefficient"],
            p["area_m2"],
            p["mass_kg"],
        )

        missile_velocity += (
            missile_acceleration + missile_drag
        ) * dt

        missile_velocity = cap_speed(
            missile_velocity,
            missile_max_speed,
        )

        # Interceptor remains at its launch position until detection.
        if detected:
            pursuit_direction = unit(
                missile_position - interceptor_position
            )

            apn_command = apn_acceleration(
                interceptor_position,
                interceptor_velocity,
                missile_position,
                missile_velocity,
                accel_limit=interceptor_accel_limit,
            )

            interceptor_command = (
                pursuit_direction * (0.5 * interceptor_accel_limit)
                + apn_command
            )

            command_norm = norm(interceptor_command)
            if command_norm > interceptor_accel_limit:
                interceptor_command *= (
                    interceptor_accel_limit / command_norm
                )

            interceptor_wind = np.asarray(
                interceptor_weather["wind_m_s"],
                dtype=float,
            )

            interceptor_density = atmosphere_density(
                0.0,
                interceptor_weather["density_kg_m3"],
            )

            interceptor_drag = drag_acceleration(
                interceptor_velocity - interceptor_wind,
                interceptor_density,
                p["drag_coefficient"],
                p["area_m2"],
                p["mass_kg"],
            )

            interceptor_acceleration = (
                interceptor_command + interceptor_drag
            )

            interceptor_velocity += (
                interceptor_acceleration * dt
            )

            interceptor_velocity = cap_speed(
                interceptor_velocity,
                interceptor_max_speed,
            )
        else:
            interceptor_acceleration = np.zeros(3, dtype=float)
            interceptor_velocity = np.zeros(3, dtype=float)

        missile_position += missile_velocity * dt
        interceptor_position += interceptor_velocity * dt

        t += dt
        final_time = t

        if t >= next_record_time - 1e-8:
            record_state()
            next_record_time += 1.0

        travelled_km = norm(
            missile_position
            - np.array(
                [attacker_x * 1000.0, attacker_y * 1000.0, 0.0]
            )
        ) / 1000.0

        if travelled_km > float(w["max_missile_range_km"]):
            status = "missile_out_of_bounds"
            break

    record_state(force=True)

    if status == "intercepted":
        trajectory[-1]["missile"]["status"] = "INTERCEPTED"
        trajectory[-1]["interceptor"]["status"] = "INTERCEPTED"
    elif status == "target_hit":
        trajectory[-1]["missile"]["status"] = "TARGET HIT"
        trajectory[-1]["interceptor"]["status"] = "MISSED"
    else:
        trajectory[-1]["missile"]["status"] = status.upper()
        trajectory[-1]["interceptor"]["status"] = (
            "TRACKING" if detected else "NOT DETECTED"
        )

    return {
        "run": run_index,
        "status": status,
        "time_s": round(final_time, 3),
        "closest_m": float(closest_approach),
        "distance_km": float(initial_distance_km),
        "layer": str(base_layer),
        "target_layer": str(base_layer),
        "attacker_id": attacker.identifier,
        "target_id": target.identifier,
        "detected": detected,
        "trajectory": trajectory,
    }
