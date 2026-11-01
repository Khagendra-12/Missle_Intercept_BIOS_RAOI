
from typing import Any

from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    config: dict[str, Any] | None = None

    # The demonstration defaults to exactly one Monte Carlo trial.
    runs: int = Field(default=1, ge=1, le=1_000_000)

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
