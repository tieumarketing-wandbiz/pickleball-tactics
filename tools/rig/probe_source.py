import bpy, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,'assets-src','mixamo','Jump.fbx'),automatic_bone_orientation=False,use_prepost_rot=True)
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); act=a.animation_data.action; a.animation_data.action=None; bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
print('object',tuple(a.location),tuple(a.rotation_euler),tuple(a.scale))
p={b.name.split(':',1)[-1]:b for b in a.pose.bones}; d={b.name.split(':',1)[-1]:b for b in a.data.bones}
for fr in [0,1,20,40,65]:
 a.animation_data.action=act; bpy.context.scene.frame_set(fr); bpy.context.view_layer.update(); h=p['Hips']; print(fr,'pose head',tuple(round(x,4) for x in h.head),'world head',tuple(round(x,4) for x in (a.matrix_world@h.head)),'data head',tuple(round(x,4) for x in d['Hips'].head_local),'world data',tuple(round(x,4) for x in (a.matrix_world@d['Hips'].head_local)))
