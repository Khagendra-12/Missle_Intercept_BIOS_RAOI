from __future__ import annotations
import numpy as np

G=9.80665

def norm(v):
    return float(np.linalg.norm(v))

def unit(v):
    n=norm(v)
    return np.asarray(v,dtype=float)/n if n>1e-12 else np.zeros(3)

def atmosphere_density(altitude_m:float, weather_density:float)->float:
    # Simple exponential attenuation; altitude is local relative altitude.
    return max(0.01,float(weather_density)*np.exp(-max(0.0,altitude_m)/8500.0))

def drag_acceleration(v_rel_m_s, rho, cd, area, mass):
    v=np.asarray(v_rel_m_s,dtype=float); speed=norm(v)
    if speed<1e-9:return np.zeros(3)
    return -0.5*float(rho)*float(cd)*float(area)/float(mass)*speed*v

def launch_speed(t:float, vmax:float, accel:float, hold_s:float)->float:
    t_acc=max(0.0,float(vmax)/max(1e-9,float(accel)))
    if t<t_acc: return min(vmax,accel*t)
    if t<t_acc+hold_s: return vmax
    # Cruise phase: speed then evolves under drag in the integrator.
    return vmax

def gravity_vector():
    return np.array([0.0,0.0,-G])

def rk4_step(state, derivative, dt):
    k1=derivative(state)
    k2=derivative(state+0.5*dt*k1)
    k3=derivative(state+0.5*dt*k2)
    k4=derivative(state+dt*k3)
    return state+(dt/6.0)*(k1+2*k2+2*k3+k4)
