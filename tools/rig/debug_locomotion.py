import bpy, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public','anim','locomotion.glb'))
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
pbs={b.name.split(':',1)[-1]:b for b in a.pose.bones}
print('actions',[x.name for x in bpy.data.actions])
act=next((x for x in bpy.data.actions if 'idle_ready' in x.name),None); a.animation_data_create(); a.animation_data.action=act
sc=bpy.context.scene; camd=bpy.data.cameras.new('C'); cam=bpy.data.objects.new('C',camd); sc.collection.objects.link(cam); cam.location=(0,-4,1.05); cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); camd.lens=48; sc.camera=cam; sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=320; sc.render.resolution_y=420; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'
for fr in [0,30,75]:
    sc.frame_set(fr); bpy.context.view_layer.update(); print(fr,[(n,tuple(round(v,3) for v in pbs[n].head)) for n in ['Hips','Spine','LeftFoot','Head'] if n in pbs]); sc.render.filepath=os.path.join(ROOT,'tools','rig','anim',f'debug-loco-{fr}.png'); bpy.ops.render.render(write_still=True)
