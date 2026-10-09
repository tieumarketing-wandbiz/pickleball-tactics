import bpy, json, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
def suf(n): return n.split(':',1)[-1]
def info(a):
    bpy.context.view_layer.update()
    return {suf(b.name):list((a.matrix_world@b.head)) for b in a.data.bones}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'tools','rig','out','human-rig.fixed.glb'))
ta=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); ti=info(ta)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,'assets-src','mixamo','Ready Idle.fbx'),automatic_bone_orientation=False,use_prepost_rot=True)
sa=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); si=info(sa); s=sa.scale.x
names=['Hips','Spine','LeftShoulder','RightShoulder','LeftArm','RightArm','LeftUpLeg','RightUpLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase','Head']
print(json.dumps({'scale':s,'source':{n:[round(v/s,5) for v in si[n]] for n in names if n in si},'target':{n:[round(v,5) for v in ti[n]] for n in names if n in ti}},indent=2))
