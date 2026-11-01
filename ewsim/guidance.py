from __future__ import annotations

import numpy as np

from .physics import unit, norm


def _limit_acceleration(
    acceleration: np.ndarray,
    accel_limit: float,
) -> np.ndarray:
    """Limit acceleration magnitude while preserving its direction."""
    magnitude = norm(acceleration)

    if magnitude > accel_limit and magnitude > 0.0:
        return acceleration * (accel_limit / magnitude)

    return acceleration


def apn_acceleration(
    position,
    velocity,
    target_position,
    target_velocity,
    navigation_constant: float = 4.0,
    accel_limit: float = 20.0 * 9.80665,
    target_acceleration=None,
) -> np.ndarray:
    """
    Augmented proportional navigation (APN).

    All positions are in metres.
    All velocities are in metres per second.
    All accelerations are in metres per second squared.

    target_acceleration is optional and defaults to zero,
    preserving compatibility with existing callers.
    """

    position = np.asarray(position, dtype=float)
    velocity = np.asarray(velocity, dtype=float)

    target_position = np.asarray(target_position, dtype=float)
    target_velocity = np.asarray(target_velocity, dtype=float)

    if any(
        vector.shape != (3,)
        for vector in (
            position,
            velocity,
            target_position,
            target_velocity,
        )
    ):
        raise ValueError("APN inputs must be three-dimensional vectors.")

    if not all(
        np.all(np.isfinite(vector))
        for vector in (
            position,
            velocity,
            target_position,
            target_velocity,
        )
    ):
        raise ValueError("APN inputs must contain finite values.")

    navigation_constant = float(navigation_constant)
    accel_limit = float(accel_limit)

    if navigation_constant <= 0.0:
        raise ValueError("Navigation constant must be positive.")

    if accel_limit < 0.0:
        raise ValueError("Acceleration limit cannot be negative.")

    if target_acceleration is None:
        target_acceleration = np.zeros(3, dtype=float)
    else:
        target_acceleration = np.asarray(
            target_acceleration,
            dtype=float,
        )

        if target_acceleration.shape != (3,):
            raise ValueError(
                "Target acceleration must be a three-dimensional vector."
            )

        if not np.all(np.isfinite(target_acceleration)):
            raise ValueError(
                "Target acceleration must contain finite values."
            )

    # Relative position and velocity.
    r = target_position - position
    v_rel = target_velocity - velocity

    distance = norm(r)

    if distance < 1e-9 or accel_limit == 0.0:
        return np.zeros(3, dtype=float)

    los = unit(r)

    # Positive closing speed means the range is decreasing.
    closing_speed = -float(np.dot(v_rel, los))

    if closing_speed <= 0.0:
        return np.zeros(3, dtype=float)

    # Line-of-sight angular velocity.
    los_rate = np.cross(r, v_rel) / (distance * distance)

    # Conventional proportional-navigation acceleration.
    pn_acceleration = (
        navigation_constant
        * closing_speed
        * np.cross(los_rate, los)
    )

    # Target acceleration perpendicular to the line of sight.
    target_acceleration_normal = (
        target_acceleration
        - np.dot(target_acceleration, los) * los
    )

    # Augmentation term.
    apn_acceleration_command = (
        pn_acceleration
        + 0.5 * navigation_constant * target_acceleration_normal
    )

    return _limit_acceleration(
        apn_acceleration_command,
        accel_limit,
    )