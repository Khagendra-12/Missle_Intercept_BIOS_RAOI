from __future__ import annotations
import math, numpy as np
from .physics import drag_acceleration, atmosphere_density, gravity_vector, launch_speed, norm
from .guidance import apn_acceleration
from .rng import keyed_rng

def simulate_engagement(cfg:dict, world, weather, run_index:int, layer:int|None=None)->dict:
    w=cfg["world"]; p=cfg["physics"]; s=cfg["simulation"]
    rng=keyed_rng(s["seed"],"engagement",run_index,layer if layer is not None else "base")
    na=int(w["na"])
    trajectory = []
    # Local origin and target cells only. Global universe is never generated.
    oi=int(rng.integers(0,na)); oj=int(rng.integers(0,na))
    ti=int(rng.integers(0,na)); tj=int(rng.integers(0,na))
    base_layer=int(rng.integers(0,10**6)) if layer is None else int(layer)
    target_layer=max(0,min(10**100,base_layer+int(rng.integers(-w["max_layer_separation"],w["max_layer_separation"]+1))))
    ox,oy=world.cell_center_xy(oi,oj); tx,ty=world.cell_center_xy(ti,tj)
    # Cell center in km; vertical separation is converted only when bounded.
    dz_layers=world.layer_difference(target_layer,base_layer)
    if abs(dz_layers)>w["max_layer_separation"]:
        return {"run":run_index,"status":"infeasible","reason":"layer separation",
                "layer":str(base_layer),"target_layer":str(target_layer)}
    r0=np.array([ox*1000,oy*1000,0.0],float)
    target=np.array([tx*1000,ty*1000,dz_layers*1000.0],float)
    delta=target-r0; distance=norm(delta)
    if distance>w["max_missile_range_km"]*1000:
        return {"run":run_index,"status":"out_of_range","distance_km":distance/1000,
                "layer":str(base_layer),"target_layer":str(target_layer)}
    direction=delta/max(distance,1e-9)
    # Missile and interceptor launch from same origin point; interceptor is
    # tasked toward the missile's estimated future position.
    mp=r0.copy(); mv=np.zeros(3); ip=r0.copy(); iv=np.zeros(3)
    dt=float(p["dt_s"]); t=0.0; closest=distance
    target_velocity=np.zeros(3)
    phase="accelerating"
    max_t=float(s["max_time_s"])
    detected=False
    while t<max_t:
        trajectory.append({
            "timeS": t,
            "missile": {
                "xKm": float(mp[0] / 1000),
                "yKm": float(mp[1] / 1000),
                "layer": str(base_layer),
                "velocityMps": float(norm(mv)),
                "headingDeg": float(
                    math.degrees(math.atan2(mv[1], mv[0]))
                ),
                "accelerationMps2": 0.0,
                "status": "IN FLIGHT",
            },
            "interceptor": {
                "xKm": float(ip[0] / 1000),
                "yKm": float(ip[1] / 1000),
                "layer": str(base_layer),
                "velocityMps": float(norm(iv)),
                "headingDeg": float(
                    math.degrees(math.atan2(iv[1], iv[0]))
                ),
                "accelerationMps2": 0.0,
                "status": "TRACKING",
            },
            "separationM": float(norm(ip - mp)),
        })
        miss_to_int=ip-mp; d=norm(miss_to_int); closest=min(closest,d)
        if d<=p["interception_radius_m"]:
            return {"run":run_index,"status":"intercepted","time_s":t,"closest_m":d,
                    "distance_km":distance/1000,"layer":str(base_layer),"target_layer":str(target_layer)}
        # Detection range is weather-attenuated; sample lazily at current cell.
        wx=weather.sample(mp[0]/1000,mp[1]/1000,base_layer)
        detect_range=p["detection_range_km"]*1000*max(0.3,1.0-abs(wx["grf"])*0.03)
        detected=detected or d<=detect_range
        # APN interceptor guidance; no evasion/avoidance subsystem.
        cmd=apn_acceleration(ip,iv,mp,mv) if detected else direction*p["interceptor_accel_m_s2"]
        # Acceleration profile until vmax, hold, then coast with drag.
        ispeed=launch_speed(t,p["interceptor_max_speed_m_s"],p["interceptor_accel_m_s2"],p["interceptor_hold_s"])
        if norm(iv)<ispeed:
            iv=iv+cmd*dt
            if norm(iv)>ispeed:iv=iv/norm(iv)*ispeed
        # Missile accelerates along target line, then has drag + gravity.
        mspeed=launch_speed(t,p["missile_max_speed_m_s"],p["missile_accel_m_s2"],p["missile_hold_s"])
        if norm(mv)<mspeed: mv=mv+direction*p["missile_accel_m_s2"]*dt
        # Weather and aerodynamic drag evaluated only when in active trajectory.
        wxm=weather.sample(mp[0]/1000,mp[1]/1000,base_layer)
        rho=atmosphere_density(mp[2],wxm["density_kg_m3"])
        drag=drag_acceleration(mv-np.array(wxm["wind_m_s"]),rho,p["drag_coefficient"],p["area_m2"],p["mass_kg"])
        mv=mv+(drag+gravity_vector())*dt
        # Interceptor also experiences gravity and drag.
        wxi=weather.sample(ip[0]/1000,ip[1]/1000,base_layer)
        rhoi=atmosphere_density(ip[2],wxi["density_kg_m3"])
        idrag=drag_acceleration(iv-np.array(wxi["wind_m_s"]),rhoi,p["drag_coefficient"],p["area_m2"],p["mass_kg"])
        iv=iv+(cmd+idrag+gravity_vector())*dt
        mp=mp+mv*dt; ip=ip+iv*dt; t+=dt
        # Projectile range is capped at 20 km from launch; leaving domain kills missile.
        if norm(mp-r0)>p["missile_max_speed_m_s"]*max_t or norm(mp-r0)>w["max_missile_range_km"]*1000:
            return {"run":run_index,"status":"missile_out_of_bounds","time_s":t,
                    "distance_km":distance/1000,"layer":str(base_layer)}
        if mp[2]<0 or ip[2]<0:
            return {"run":run_index,"status":"ground_impact","time_s":t,
                    "distance_km":distance/1000,"layer":str(base_layer)}
        if norm(mp-target)<=p["interception_radius_m"]:
            return {"run":run_index,"status":"target_hit","time_s":t,
                    "distance_km":distance/1000,"layer":str(base_layer)}
    return {
    "run": run_index,
    "status": "intercepted",
    "time_s": t,
    "closest_m": d,
    "trajectory": trajectory,
}
