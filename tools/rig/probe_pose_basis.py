import bpy, os
from mathutils import Quaternion
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
def s(n): return n.split(':',1)[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'tools','rig','out','human-rig.fixed.glb'))
t=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,'assets-src','mixamo','Ready Idle.fbx'),automatic_bone_orientation=False,use_prepost_rot=True)
src=[o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o!=t][-1]
src.animation_data.action=None
bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
for a in [t,src]:
 print('\nARM',a.name)
 p={s(b.name):b for b in a.pose.bones}; d={s(b.name):b for b in a.data.bones}
 for n in ['Hips','Spine','LeftUpLeg','LeftArm','Head']:
  b=p[n]; db=d[n]
  print(n,'pb rot',tuple(round(x,4) for x in b.rotation_quaternion),'basis',tuple(round(x,4) for x in b.matrix_basis.to_quaternion()),'pmat',tuple(round(x,4) for x in b.matrix.to_quaternion()),'dmat',tuple(round(x,4) for x in db.matrix_local.to_quaternion()))
