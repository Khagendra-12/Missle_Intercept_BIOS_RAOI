from __future__ import annotations
from .rng import keyed_rng
from .engagement import simulate_engagement

def run_monte_carlo(cfg:dict, world, weather, progress=None)->dict:
    count=int(cfg["simulation"]["monte_carlo_runs"])
    paired_every=int(cfg["simulation"].get("paired_layer_every",10))
    results=[]; previous_layer=0
    for n in range(count):
        # Every 10th case replays prior run's parameter seed at a different layer.
        paired_layer=None
        if paired_every>0 and n>0 and n%paired_every==0:
            rng=keyed_rng(cfg["simulation"]["seed"],"paired-layer",n)
            paired_layer=int(rng.integers(0,10**6))
        result=simulate_engagement(cfg,world,weather,n,layer=paired_layer)
        results.append(result)
        if progress: progress(n+1,count)
    tally={}
    for r in results:tally[r["status"]]=tally.get(r["status"],0)+1
    return {"runs":count,"summary":tally,"intercept_rate":tally.get("intercepted",0)/max(1,count),
            "results":results}
