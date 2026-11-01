
from __future__ import annotations

import math

from .engagement import simulate_engagement


def wilson_interval(successes: int, total: int, z: float = 1.96):
    """Calculate a 95% Wilson confidence interval."""
    if total <= 0:
        return [0.0, 0.0]

    proportion = successes / total
    denominator = 1.0 + z * z / total

    center = (
        proportion + z * z / (2.0 * total)
    ) / denominator

    margin = (
        z
        * math.sqrt(
            proportion * (1.0 - proportion) / total
            + z * z / (4.0 * total * total)
        )
        / denominator
    )

    return [
        max(0.0, center - margin),
        min(1.0, center + margin),
    ]


def run_monte_carlo(
    cfg: dict,
    world,
    weather,
    progress=None,
) -> dict:
    """
    Execute the configured number of engagements.

    The first engagement retains its complete trajectory for frontend
    playback. Other runs retain their summary data to avoid storing
    potentially enormous trajectory collections in memory.
    """

    simulation_cfg = cfg["simulation"]

    count = int(simulation_cfg.get("monte_carlo_runs", 1))

    if not 1 <= count <= 1_000_000:
        raise ValueError(
            "monte_carlo_runs must be between 1 and 1,000,000."
        )

    results = []
    primary_result = None
    tally = {}

    for run_index in range(count):
        result = simulate_engagement(
            cfg=cfg,
            world=world,
            weather=weather,
            run_index=run_index,
            layer=None,
        )

        if run_index == 0:
            # Preserve the complete first trajectory for the dashboard.
            primary_result = result
            results.append(result)
        else:
            # Keep statistical results without duplicating large trajectories.
            compact_result = {
                key: value
                for key, value in result.items()
                if key != "trajectory"
            }
            results.append(compact_result)

        status = result.get("status", "unknown")
        tally[status] = tally.get(status, 0) + 1

        if progress is not None:
            progress(run_index + 1, count)

    intercepted = tally.get("intercepted", 0)
    target_hits = tally.get("target_hit", 0)

    intercept_rate = intercepted / count
    success_interval = wilson_interval(intercepted, count)

    primary_result = primary_result or {}

    return {
        "runs": count,
        "summary": tally,
        "intercept_rate": intercept_rate,
        "target_hit_rate": target_hits / count,
        "confidence_interval_95": success_interval,

        # Convenient fields for the frontend.
        "status": primary_result.get("status", "unknown"),
        "trajectory": primary_result.get("trajectory", []),
        "primary_result": primary_result,

        # Per-run summaries; the first run contains its full trajectory.
        "results": results,
    }
