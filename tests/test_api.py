from fastapi.testclient import TestClient
from ewsim.api import app
client=TestClient(app)
def test_health(): assert client.get("/health").status_code==200
def test_default_config(): assert client.get("/config/default").status_code==200
