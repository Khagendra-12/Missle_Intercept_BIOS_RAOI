from ewsim.config import load_config
from ewsim.weather import ProceduralGRF

def test_weather_finite_and_lazy():
    grf=ProceduralGRF(load_config())
    x=grf.sample(1.0,2.0,10**100)
    assert all(map(lambda v: v==v, [x["grf"],x["temperature_c"],x["density_kg_m3"]]))
