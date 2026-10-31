from __future__ import annotations
import numpy as np
from .rng import keyed_rng

class ProceduralGRF:
    """Lazy stationary correlated Gaussian field via random Fourier features.

    A sample is generated on demand. The field is correlated in x/y and layer
    using anisotropic length scales; no grid/tensor is allocated.
    """
    def __init__(self,cfg:dict):
        c=cfg["weather"]; self.seed=int(c["seed"])
        self.n=int(c["features"]); self.lx=float(c["length_scale_km"])
        self.lz=max(1e-6,float(c["layer_length_scale"]))
        r=keyed_rng(self.seed,"grf-parameters")
        self.freq_xy=r.normal(0,1,(self.n,2))/self.lx
        self.freq_z=r.normal(0,1,self.n)/self.lz
        self.phase=r.uniform(0,2*np.pi,self.n)
        self.weight=r.normal(0,1,self.n)/np.sqrt(self.n)
        self.c=c

    def scalar(self,x_km:float,y_km:float,layer:int)->float:
        # For enormous layer labels, use local layer offset only. Do not float()
        # the absolute layer number (which would destroy precision).
        z=float(layer % 1_000_003)
        arg=self.freq_xy[:,0]*x_km+self.freq_xy[:,1]*y_km+self.freq_z*z+self.phase
        return float(np.sqrt(2.0)*np.dot(self.weight,np.cos(arg)))

    def sample(self,x_km:float,y_km:float,layer:int)->dict:
        g=self.scalar(x_km,y_km,layer)
        c=self.c
        temp=float(c["temperature_base_c"]+c["temperature_sigma_c"]*g)
        density=max(0.05,float(c["density_base_kg_m3"]*(1+c["density_sigma"]*g)))
        r=keyed_rng(self.seed,"wind",round(x_km,4),round(y_km,4),int(layer))
        wind=r.normal(0,float(c["wind_sigma_m_s"]),size=3)
        return {"grf":g,"temperature_c":temp,"density_kg_m3":density,
                "wind_m_s":[float(v) for v in wind]}
