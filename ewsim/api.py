
from __future__ import annotations

import math
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import load_config, merge_config
from .schemas import SimulationRequest
from .world import ProceduralWorld
from .weather import ProceduralGRF
from .monte_carlo import run_monte_carlo


app = FastAPI(
    title="Procedural EW Simulator",
    version="0.2.0",
    description="Backend for the layered-world simulation dashboard.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, dict] = {}


def prepare(req: SimulationRequest) -> dict:
    """Load defaults and apply request overrides."""

    cfg = merge_config(load_config(), req.config)

    cfg.setdefault("simulation", {})
    cfg.setdefault("physics", {})

    if req.runs is not None:
        cfg["simulation"]["monte_carlo_runs"] = req.runs

    if req.seed is not None:
        cfg["simulation"]["seed"] = req.seed

    if req.interceptor_speed_m_s is not None:
        cfg["physics"]["interceptor_max_speed_m_s"] = (
            req.interceptor_speed_m_s
        )

    # This dashboard demonstration is restricted to one attacker.
    cfg["simulation"]["attacker_count"] = 1
    cfg["simulation"]["max_simultaneous_attackers"] = 1
    cfg["simulation"]["monte_carlo_runs"] = max(
        1,
        min(
            1_000_000,
            int(cfg["simulation"].get("monte_carlo_runs", 1)),
        ),
    )

    return cfg


def run_job(job_id: str, cfg: dict) -> None:
    """Execute a simulation and retain its result for frontend polling."""

    JOBS[job_id] = {
        "status": "running",
        "result": None,
    }

    try:
        world = ProceduralWorld(cfg)
        weather = ProceduralGRF(cfg)

        result = run_monte_carlo(
            cfg,
            world,
            weather,
        )

        JOBS[job_id] = {
            "status": "completed",
            "result": result,
        }

    except Exception as exc:
        JOBS[job_id] = {
            "status": "failed",
            "result": None,
            "error": str(exc),
        }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.2.0",
    }


@app.get("/config/default")
def default_config():
    return load_config()


@app.post("/simulations")
def create_simulation(
    req: SimulationRequest,
    background: BackgroundTasks,
):
    cfg = prepare(req)
    job_id = str(uuid4())

    JOBS[job_id] = {
        "status": "queued",
        "result": None,
    }

    background.add_task(
        run_job,
        job_id,
        cfg,
    )

    return {
        "job_id": job_id,
        "status": "queued",
    }


@app.post("/simulations/run")
def run_sync(req: SimulationRequest):
    cfg = prepare(req)

    world = ProceduralWorld(cfg)
    weather = ProceduralGRF(cfg)

    return run_monte_carlo(
        cfg,
        world,
        weather,
    )


@app.get("/simulations/{job_id}")
def get_simulation(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(
            status_code=404,
            detail="Unknown simulation ID",
        )

    return {
        "job_id": job_id,
        **JOBS[job_id],
    }


@app.get("/api/config")
def frontend_config():
    cfg = load_config()

    world = cfg["world"]
    physics = cfg["physics"]
    simulation = cfg["simulation"]
    weather = cfg["weather"]

    guidance = cfg.get("guidance", {})

    return {
        "monteCarloRuns": 1,
        "attackerCount": 1,
        "maxConcurrentAttacks": 1,
        "gridSize": world["na"],
        "targetDistanceMinKm": world.get(
            "target_range_km", [10, 20]
        )[0],
        "targetDistanceMaxKm": world.get(
            "target_range_km", [10, 20]
        )[1],
        "missileMaxSpeedMps": physics["missile_max_speed_m_s"],
        "interceptorMaxSpeedMps": physics[
            "interceptor_max_speed_m_s"
        ],
        "missileMaxRangeKm": world["max_missile_range_km"],
        "detectionRangeKm": physics["detection_range_km"],
        "interceptionRadiusM": physics["interception_radius_m"],
        "simulationTimeLimitS": simulation["max_time_s"],
        "randomSeed": str(simulation["seed"]),
        "weather": {
            "spatialCorrelation": weather.get(
                "length_scale_km", 8.0
            ),
            "layerCorrelation": weather.get(
                "layer_length_scale", 2.0
            ),
            "intensity": weather.get(
                "temperature_sigma_c", 8.0
            ),
        },
        "guidance": {
            "navigationConstant": guidance.get(
                "navigation_constant", 3.0
            ),
            "autopilotLagS": guidance.get(
                "autopilot_lag_s", 0.2
            ),
            "dragCoefficient": physics["drag_coefficient"],
            "integrationStepS": physics["dt_s"],
        },
    }


@app.post("/api/config")
def update_frontend_config(config: dict):
    try:
        updated = merge_config(
            load_config(),
            config,
        )

        return {
            "status": "validated",
            "config": updated,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )


@app.get("/api/simulations/{job_id}/trajectory")
def get_trajectory(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(
            status_code=404,
            detail="Unknown simulation ID",
        )

    job = JOBS[job_id]

    if job["status"] in ("queued", "running"):
        raise HTTPException(
            status_code=409,
            detail="Simulation is still running",
        )

    if job["status"] == "failed":
        raise HTTPException(
            status_code=500,
            detail=job.get("error", "Simulation failed"),
        )

    result = job.get("result") or {}

    # First check the convenient top-level trajectory.
    trajectory = result.get("trajectory")

    # Fall back to the primary engagement result.
    if not trajectory:
        primary = result.get("primary_result") or {}
        trajectory = primary.get("trajectory")

    # Finally, check the first individual Monte Carlo result.
    if not trajectory:
        runs = result.get("results", [])

        if runs:
            trajectory = runs[0].get("trajectory")

    if not trajectory:
        raise HTTPException(
            status_code=404,
            detail="No trajectory was recorded for this simulation",
        )

    return trajectory


@app.get("/api/simulations/environment")
def get_cell_environment(
    layer: str,
    x: int,
    y: int,
):
    cfg = load_config()

    weather = ProceduralGRF(cfg)
    layer_index = int(layer)

    env = weather.sample(
        float(x),
        float(y),
        layer_index,
    )

    wind = env.get("wind_m_s", [0.0, 0.0, 0.0])

    wind_speed = math.sqrt(
        sum(float(component) ** 2 for component in wind)
    )

    wind_direction = math.degrees(
        math.atan2(float(wind[1]), float(wind[0]))
    )

    return {
        "layer": str(layer_index),
        "x": x,
        "y": y,
        "temperatureK": (
            float(env["temperature_c"]) + 273.15
        ),
        "densityKgM3": env["density_kg_m3"],
        "windSpeedMps": wind_speed,
        "windDirectionDeg": wind_direction,
        "windVector": wind,
        "grfIntensity": env["grf"],
    }
