from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    config: dict[str, Any] | None = None

    # Monte Carlo runs: minimum 1, maximum 1,000,000.
    runs: int | None = Field(
        default=None,
        ge=1,
        le=1_000_000,
    )

    interceptor_speed_m_s: float | None = Field(
        default=None,
        ge=1,
        le=1000,
    )

    seed: int | None = None


class SimulationResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str, Any] | None = None