from __future__ import annotations
import numpy as np
from .physics import unit, norm

def apn_acceleration(position, velocity, target_position, target_velocity,
                      navigation_constant=4.0, accel_limit=20*9.80665):
    """Augmented proportional navigation command, translational 3-DOF."""
    r=np.asarray(target_position)-np.asarray(position)
    vrel=np.asarray(target_velocity)-np.asarray(velocity)
    rr=norm(r)
    if rr<1e-6:return np.zeros(3)
    los=unit(r)
    closing=-float(np.dot(vrel,los))
    omega=np.cross(r,vrel)/(rr*rr)
    a=np.asarray(navigation_constant*closing*np.cross(omega,los))
    n=norm(a)
    if n>accel_limit:a=a*(accel_limit/n)
    return a

def engagement_feasible(distance_m, relative_speed_m_s, accel_m_s2, radius_m=3.0):
    distance=max(0.0,float(distance_m)-float(radius_m))
    speed=max(1e-3,float(relative_speed_m_s))
    return distance/speed <= max(0.0,2.0*speed/max(1e-3,accel_m_s2)
                                  + distance/speed)
