from pydantic import BaseModel, Field
from typing import Any

class SimulationRequest(BaseModel):
    config: dict[str,Any] | None = None
    runs: int | None = Field(default=None,ge=1,le=100000)
    interceptor_speed_m_s: float | None = Field(default=None,ge=1,le=1000)
    seed: int | None = None

class SimulationResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str,Any] | None = None
