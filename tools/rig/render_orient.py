import bpy, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'tools','rig','out','human-rig.fixed.glb'))
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); sc=bpy.context.scene
cd=bpy.data.cameras.new('c'); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=320; sc.render.resolution_y=420; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'
for n,loc in [('minus',(0,-4,1.0)),('plus',(0,4,1.0))]:
 cam.location=loc; cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); sc.render.filepath=os.path.join(ROOT,'tools','rig','anim',f'orient-{n}.png'); bpy.ops.render.render(write_still=True)
