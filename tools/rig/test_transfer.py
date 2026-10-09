import bpy, os
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def suf(n): return n.split(':',1)[-1]
def bones(a): return {suf(b.name): b for b in a.pose.bones}
def rest_data(a): return {suf(b.name): b for b in a.data.bones}
def world_mat(a, b): return a.matrix_world @ b.matrix
def rest_world(a, b): return a.matrix_world @ b.matrix_local
def parents(pb):
    out=[]
    while pb:
        out.append(pb)
        pb=pb.parent
    return out

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'tools','rig','out','human-rig.fixed.glb'))
target=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT,'assets-src','mixamo','Ready Idle.fbx'), automatic_bone_orientation=False, use_prepost_rot=True)
source=[o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o != target][-1]
sp=bones(source); tp=bones(target); sr=rest_data(source); tr=rest_data(target)
act = source.animation_data.action
source.animation_data.action = None
bpy.context.scene.frame_set(0); bpy.context.view_layer.update()
src_effective_rest_q={n:(source.matrix_world @ sp[n].matrix).to_quaternion() for n in sp}
source.animation_data.action=act
bpy.context.scene.frame_set(1); bpy.context.view_layer.update()

src_rest_q={n:(source.matrix_world @ sr[n].matrix_local).to_quaternion() for n in sp if n in sr}
tgt_rest_q={n:(target.matrix_world @ tr[n].matrix_local).to_quaternion() for n in tp if n in tr}
print('source deltas', {n: tuple(round(x,4) for x in (src_effective_rest_q[n].inverted() @ (source.matrix_world @ sp[n].matrix).to_quaternion())) for n in ['Hips','Spine','LeftUpLeg','LeftArm','Head']})
ordered=sorted((n for n in tp if n in sp and n in tr), key=lambda n: len(parents(tp[n])))

for n in ordered:
    delta=src_effective_rest_q[n].inverted() @ (source.matrix_world @ sp[n].matrix).to_quaternion()
    desired_q=tgt_rest_q[n] @ delta
    rest_m=target.matrix_world @ tr[n].matrix_local
    desired=desired_q.to_matrix().to_4x4(); desired.translation=rest_m.translation
    tp[n].matrix = target.matrix_world.inverted() @ desired
bpy.context.view_layer.update()
print('heads', {n: tuple(round(v,3) for v in (target.matrix_world @ tp[n].head)) for n in ['Hips','Spine','LeftFoot','Head']})
print('quats', {n: tuple(round(v,3) for v in tp[n].rotation_quaternion) for n in ['Hips','Spine','LeftUpLeg','LeftArm']})

sc=bpy.context.scene; cd=bpy.data.cameras.new('test'); cam=bpy.data.objects.new('test',cd); sc.collection.objects.link(cam)
cam.location=(0,-4,1.0); cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); cd.lens=48; sc.camera=cam
sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=320; sc.render.resolution_y=420; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.filepath=os.path.join(ROOT,'tools','rig','anim','test-transfer.png'); bpy.ops.render.render(write_still=True)
