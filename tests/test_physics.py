import numpy as np
from ewsim.physics import launch_speed,gravity_vector,drag_acceleration

def test_launch_profile():
    assert launch_speed(0,100,20,1)==0
    assert launch_speed(2,100,20,1)==40
    assert launch_speed(7,100,20,1)==100

def test_gravity_negative_z():
    assert gravity_vector()[2]<0

def test_drag_opposes_velocity():
    a=drag_acceleration(np.array([100.,0,0]),1.2,.3,.03,30)
    assert a[0]<0
