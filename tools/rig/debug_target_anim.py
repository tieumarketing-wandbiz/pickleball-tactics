import bpy, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'tools','rig','out','human-rig.fixed.glb'))
a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE'); m=next(o for o in bpy.context.scene.objects if o.type=='MESH'); bpy.context.view_layer.update()
def suf(n): return n.split(':',1)[-1]
pbs={suf(b.name):b for b in a.pose.bones}
print('rest',a.matrix_world.translation[:],[(n,tuple(pbs[n].head)) for n in ['Hips','Spine','LeftFoot','Head']])
sc=bpy.context.scene; cam=bpy.data.cameras.new('C'); co=bpy.data.objects.new('C',cam); sc.collection.objects.link(co); co.location=(0,-4,1.05); co.rotation_euler=(Vector((0,0,.9))-co.location).to_track_quat('-Z','Y').to_euler(); cam.lens=48; sc.camera=co; sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=320; sc.render.resolution_y=420; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.filepath=os.path.join(ROOT,'tools','rig','anim','debug-rest.png'); bpy.ops.render.render(write_still=True)
