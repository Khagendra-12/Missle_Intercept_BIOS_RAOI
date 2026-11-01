from fastapi.testclient import TestClient
import pytest

from ewsim.api import app
from ewsim.schemas import SimulationRequest


client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_default_config():
    response = client.get("/config/default")

    assert response.status_code == 200

    config = response.json()

    assert "world" in config
    assert "weather" in config
    assert "physics" in config
    assert "simulation" in config


def test_frontend_config():
    response = client.get("/api/config")

    assert response.status_code == 200

    config = response.json()

    assert config["monteCarloRuns"] >= 1
    assert config["gridSize"] > 0
    assert config["missileMaxSpeedMps"] > 0
    assert config["interceptorMaxSpeedMps"] > 0


def test_monte_carlo_minimum_is_one():
    request = SimulationRequest(runs=1)

    assert request.runs == 1


def test_monte_carlo_maximum_is_one_million():
    request = SimulationRequest(runs=1_000_000)

    assert request.runs == 1_000_000


def test_monte_carlo_rejects_zero_runs():
    with pytest.raises(ValueError):
        SimulationRequest(runs=0)


def test_monte_carlo_rejects_more_than_one_million_runs():
    with pytest.raises(ValueError):
        SimulationRequest(runs=1_000_001)