# Procedural EW Layered-Civilization Simulator (Backend)

A deterministic, procedural backend for Monte Carlo engagements in an effectively unbounded layered world. **The layer count is never enumerated and `10**100` is never converted to a machine integer or float.** Layers are addressed by arbitrary-precision Python integers and generated on demand from keyed hashes.

## Requirements
- Python 3.11+
- `pip install -r requirements.txt`

## Run
```bash
python run.py --config config/default.json
```
OpenAPI docs are available at `http://127.0.0.1:8000/docs`.

## Architecture
- `ewsim/world.py`: lazy civilization / hostility generation, layer-index handling.
- `ewsim/weather.py`: deterministic 3D Gaussian random field approximation (correlated procedural field) sampled lazily.
- `ewsim/physics.py`: gravity, drag, kinematics, launch acceleration/cruise phases.
- `ewsim/guidance.py`: APN guidance and engagement feasibility; **no missile interception-avoidance logic**.
- `ewsim/engagement.py`: discrete-time engagement simulation and event handling.
- `ewsim/monte_carlo.py`: sequential Monte Carlo runner, paired-layer repeats every tenth run.
- `ewsim/api.py`: FastAPI backend suitable for frontend integration.
- `ewsim/schemas.py`: request/response contracts.

## Important modeling note
The world is *effectively* huge, not explicitly populated. `MAX_LAYER = 10**100` is a Python integer constant used only for bounds and labels. It is not iterated over, allocated, or converted to floating point. Coordinates used by the physics engine are local relative coordinates (km); layer indices are symbolic/discrete and only their signed difference is converted to a local vertical distance when the engagement is physically within the configured layer-distance limit. This prevents loss of precision for huge layer indices.

The GRF implementation uses a deterministic spectral-feature approximation to a stationary Gaussian field. It produces correlated samples without constructing a world-sized tensor. `weather.sample(x,y,layer)` is O(number of features), independent of total world size.

## Frontend integration
- `POST /simulations` accepts a config and returns a job ID.
- `GET /simulations/{job_id}` returns status/result.
- `POST /simulations/run` runs synchronously for simpler demos.
- `GET /health` reports service status.
- `GET /config/default` returns default config.
- Use JSON contracts in `ewsim/schemas.py`.

For a production frontend, run the API and call it from the UI. CORS is enabled for localhost development; configure allowed origins in deployment.
