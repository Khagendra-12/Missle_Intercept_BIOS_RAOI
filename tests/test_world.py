from ewsim.config import load_config
from ewsim.world import ProceduralWorld,MAX_LAYER

def test_huge_layer_is_exact_integer():
    cfg=load_config(); w=ProceduralWorld(cfg)
    layer=10**100
    assert w.validate_layer(layer)==MAX_LAYER
    assert w.layer_difference(layer,layer-1)==1

def test_lazy_civ_generation_is_deterministic():
    w=ProceduralWorld(load_config())
    assert w.civilization(1,2,3)==w.civilization(1,2,3)

def test_y_only_hostility_match():
    w=ProceduralWorld(load_config())
    assert w.hostility_match(4.0,4.2)
    assert not w.hostility_match(4.0,8.0)
