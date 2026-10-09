import bpy, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,'assets-src','mixamo','Ready Idle.fbx'),automatic_bone_orientation=False,use_prepost_rot=True)
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
sc=bpy.context.scene; cd=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); cam.location=(0,-400,100); cam.rotation_euler=(Vector((0,0,90))-cam.location).to_track_quat('-Z','Y').to_euler(); cd.lens=50; sc.camera=cam; sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=320; sc.render.resolution_y=420; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'
for fr in [0,1,30]:
 sc.frame_set(fr); bpy.context.view_layer.update(); sc.render.filepath=os.path.join(ROOT,'tools','rig','anim',f'source-{fr}.png'); bpy.ops.render.render(write_still=True); print(fr, a.matrix_world.translation, a.scale, a.rotation_euler)
