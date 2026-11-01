from __future__ import annotations

from math import sqrt

from .engagement import simulate_engagement


MIN_RUNS = 1
MAX_RUNS = 1_000_000


def wilson_interval(
    successes: int,
    total: int,
    z: float = 1.96,
) -> tuple[float, float]:
    """
    Calculate a Wilson score confidence interval for a proportion.
    Defaults to approximately 95% confidence.
    """
    if total <= 0:
        return 0.0, 0.0

    if successes < 0 or successes > total:
        raise ValueError("Success count must be between 0 and total.")

    proportion = successes / total
    z_squared = z * z

    denominator = 1.0 + z_squared / total

    center = (
        proportion + z_squared / (2.0 * total)
    ) / denominator

    margin = (
        z
        * sqrt(
            proportion * (1.0 - proportion) / total
            + z_squared / (4.0 * total * total)
        )
        / denominator
    )

    return (
        max(0.0, center - margin),
        min(1.0, center + margin),
    )


def run_monte_carlo(
    cfg: dict,
    world,
    weather,
    progress=None,
) -> dict:
    """
    Execute Monte Carlo engagement trials.

    Each trial receives a deterministic run index.
    Results are aggregated by outcome status.
    """

    count = int(cfg["simulation"]["monte_carlo_runs"])

    if not MIN_RUNS <= count <= MAX_RUNS:
        raise ValueError(
            f"Monte Carlo runs must be between "
            f"{MIN_RUNS} and {MAX_RUNS}."
        )

    results = []
    tally: dict[str, int] = {}

    for run_index in range(count):
        result = simulate_engagement(
            cfg,
            world,
            weather,
            run_index,
        )

        if not isinstance(result, dict) or "status" not in result:
            raise RuntimeError(
                f"Invalid result returned by run {run_index}."
            )

        results.append(result)

        status = str(result["status"])
        tally[status] = tally.get(status, 0) + 1

        if progress is not None:
            progress(run_index + 1, count)

    intercepted = tally.get("intercepted", 0)
    target_hits = tally.get("target_hit", 0)

    intercept_rate = intercepted / count
    target_hit_rate = target_hits / count

    ci_low, ci_high = wilson_interval(
        intercepted,
        count,
    )

    return {
        "runs": count,
        "summary": tally,
        "intercept_rate": intercept_rate,
        "target_hit_rate": target_hit_rate,
        "intercept_rate_confidence_interval_95": {
            "lower": ci_low,
            "upper": ci_high,
        },
        "confidence_interval_method": "Wilson score",
        "results": results,
    }