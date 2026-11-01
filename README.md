# Procedural EW Layered-Civilization Simulator — Backend

A Python backend for procedural layered-world generation, environmental sampling, missile/interceptor engagement experiments, and Monte Carlo analysis.

**Important:** This is an experimental implementation, not a validated flight-dynamics or operational defense model. Results should not be presented as scientifically validated until the outstanding modeling requirements have been implemented and tested.

## Requirements

- Python 3.11+
- Dependencies listed in `requirements.txt`

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the API

From the project root:

```bash
python run.py --config config/default.json
```

The API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## Backend structure

| File | Responsibility |
|---|---|
| `ewsim/api.py` | FastAPI endpoints and simulation job handling |
| `ewsim/config.py` | Configuration loading and validation |
| `ewsim/schemas.py` | Request and response validation |
| `ewsim/world.py` | Procedural civilization cells and layer handling |
| `ewsim/weather.py` | Lazy procedural environmental field |
| `ewsim/physics.py` | Physics utilities and numerical integration |
| `ewsim/guidance.py` | Augmented proportional navigation guidance |
| `ewsim/engagement.py` | Individual engagement simulation |
| `ewsim/monte_carlo.py` | Monte Carlo execution and statistical summaries |
| `ewsim/rng.py` | Deterministic random-number generation |

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/config/default` | Retrieve default configuration |
| POST | `/simulations` | Submit a simulation job |
| GET | `/simulations/{job_id}` | Retrieve job status and result |
| POST | `/simulations/run` | Run a simulation synchronously |
| GET | `/api/config` | Retrieve frontend configuration |
| POST | `/api/config` | Validate submitted configuration |
| GET | `/api/trajectory/{job_id}` | Retrieve trajectory data when available |
| GET | `/api/environment` | Retrieve environmental samples |

Check `/docs` for the actual request and response schemas.

## Configuration

Default settings are stored in:

```text
config/default.json
```

Simulation requests can override supported configuration values. Monte Carlo run counts must be between **1 and 1,000,000**, inclusive.

## Procedural world and weather

The world is generated lazily rather than allocating every civilization cell or layer.

- Layer indices use Python arbitrary-precision integers.
- The theoretical layer bound is `10**100`.
- Civilization cells are represented in two dimensions.
- Weather is sampled on demand using procedural random features.

The implementation must not allocate arrays or iterate over the full theoretical layer range.

## Current implementation limitations

The following items must not be assumed to be fully implemented merely because related modules or configuration fields exist:

- The exact revised hostility equation and its Taylor-series approximation.
- Complete attacker/target civilization selection and distance constraints.
- One-missile-per-attacker and configurable simultaneous attacker handling.
- Missile evasion using the required APN/PPO combination.
- Full RK4 integration throughout the engagement simulation.
- Paired, layer-independent Monte Carlo trials.
- Alternating configurations and the complete requested statistical reporting.
- Production-grade trajectory telemetry and validated physical parameters.

These are implementation requirements, not claims of completed functionality. Verify each against the actual backend before relying on simulation results.

## Tests

Run the complete test suite from the project root:

```bash
python -m pytest -q
```

Run an individual test file:

```bash
python -m pytest tests/test_world.py -q
```

A passing test suite only verifies the behavior covered by those tests. It does not establish scientific validity or prove that every simulation requirement is implemented.
