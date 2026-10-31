from __future__ import annotations
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
from .config import load_config,merge_config
from .schemas import SimulationRequest
from .world import ProceduralWorld
from .weather import ProceduralGRF
from .monte_carlo import run_monte_carlo

app=FastAPI(title="Procedural EW Simulator",version="0.1.0",
             description="Lazy procedural layered-world Monte Carlo backend.")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
                   allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
JOBS={}

def prepare(req:SimulationRequest):
    cfg=merge_config(load_config(),req.config)
    if req.runs is not None:cfg["simulation"]["monte_carlo_runs"]=req.runs
    if req.seed is not None:cfg["simulation"]["seed"]=req.seed
    if req.interceptor_speed_m_s is not None:cfg["physics"]["interceptor_max_speed_m_s"]=req.interceptor_speed_m_s
    return cfg

def run_job(job_id,cfg):
    try:
        world=ProceduralWorld(cfg); weather=ProceduralGRF(cfg)
        JOBS[job_id]={"status":"running","result":None}
        result=run_monte_carlo(cfg,world,weather)
        JOBS[job_id]={"status":"completed","result":result}
    except Exception as e:
        JOBS[job_id]={"status":"failed","error":str(e)}

@app.get("/health")
def health():return {"status":"ok","version":"0.1.0"}

@app.get("/config/default")
def default_config():return load_config()

@app.post("/simulations")
def create_simulation(req:SimulationRequest,background:BackgroundTasks):
    cfg=prepare(req); jid=str(uuid4())
    JOBS[jid]={"status":"queued","result":None}
    background.add_task(run_job,jid,cfg)
    return {"job_id":jid,"status":"queued"}

@app.post("/simulations/run")
def run_sync(req:SimulationRequest):
    cfg=prepare(req); world=ProceduralWorld(cfg); weather=ProceduralGRF(cfg)
    return run_monte_carlo(cfg,world,weather)

@app.get("/simulations/{job_id}")
def get_simulation(job_id:str):
    if job_id not in JOBS:raise HTTPException(404,"Unknown job_id")
    return {"job_id":job_id,**JOBS[job_id]}


@app.get("/api/config")
def frontend_config():
    cfg = load_config()

    return {
        "monteCarloRuns": cfg["simulation"]["monte_carlo_runs"],
        "attackerCount": cfg["simulation"].get("attacker_count", 1),
        "maxConcurrentAttacks": cfg["simulation"].get(
            "max_concurrent_attacks", 1
        ),
        "gridSize": cfg["world"]["na"],
        "targetDistanceMinKm": cfg["world"].get(
            "target_distance_min_km", 10
        ),
        "targetDistanceMaxKm": cfg["world"].get(
            "target_distance_max_km", 20
        ),
        "missileMaxSpeedMps": cfg["physics"]["missile_max_speed_m_s"],
        "interceptorMaxSpeedMps": cfg["physics"][
            "interceptor_max_speed_m_s"
        ],
        "missileMaxRangeKm": cfg["world"]["max_missile_range_km"],
        "detectionRangeKm": cfg["physics"]["detection_range_km"],
        "interceptionRadiusM": cfg["physics"]["interception_radius_m"],
        "simulationTimeLimitS": cfg["simulation"]["max_time_s"],
        "randomSeed": str(cfg["simulation"]["seed"]),
        "weather": {
            "spatialCorrelation": cfg["weather"]["spatial_correlation"],
            "layerCorrelation": cfg["weather"]["layer_correlation"],
            "intensity": cfg["weather"]["intensity"],
        },
        "guidance": {
            "navigationConstant": cfg["guidance"]["navigation_constant"],
            "autopilotLagS": cfg["guidance"]["autopilot_lag_s"],
            "dragCoefficient": cfg["physics"]["drag_coefficient"],
            "integrationStepS": cfg["physics"]["dt_s"],
        },
    }


@app.post("/api/config")
def update_frontend_config(config: dict):
    try:
        updated = merge_config(load_config(), config)
        return {"status": "validated", "config": updated}
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))



@app.get("/api/simulations/{job_id}/trajectory")
def get_trajectory(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Unknown simulation ID")

    result = JOBS[job_id].get("result")

    if result is None:
        raise HTTPException(
            status_code=409,
            detail="Simulation is still running"
        )

    # Adapt this to the actual structure returned by run_monte_carlo().
    trajectory = result.get("trajectory")

    if trajectory is None:
        raise HTTPException(
            status_code=501,
            detail="Trajectory recording is not yet supported"
        )

    return trajectory


@app.get("/api/simulations/environment")
def get_cell_environment(
    layer: str,
    x: int,
    y: int,
):
    cfg = load_config()

    world = ProceduralWorld(cfg)
    weather = ProceduralGRF(cfg)

    layer_index = int(layer)

    # Query only the requested cell. Never generate the entire world.
    env = weather.sample(
        float(x),
        float(y),
        layer_index,
    )

    return {
        "layer": str(layer_index),
        "x": x,
        "y": y,
        "temperatureK": env.get("temperature_k"),
        "densityKgM3": env.get("density_kg_m3"),
        "windSpeedMps": env.get("wind_speed_m_s"),
        "windDirectionDeg": env.get("wind_direction_deg"),
        "windVector": env.get("wind_m_s"),
        "grfIntensity": env.get("grf"),
    }

