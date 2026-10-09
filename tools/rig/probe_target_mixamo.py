import bpy, json, os

def suffix(n): return n.split(':',1)[-1]
def bone_info(a):
    bpy.context.view_layer.update(); out={}
    for b in a.pose.bones:
        out[suffix(b.name)]={'head':list(b.head), 'tail':list(b.tail), 'q':[round(x,6) for x in b.matrix.to_quaternion()]}
    return out

src_path=os.path.abspath('assets-src/mixamo/Ready Idle.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath('tools/rig/out/human-rig.fixed.glb'))
target=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
target_info=bone_info(target)
target_summary={'targetObject':target.name,'targetScale':list(target.scale),'targetHips':target_info.get('Hips'),'targetFoot':target_info.get('LeftFoot')}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src_path, automatic_bone_orientation=False, use_prepost_rot=True)
src=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
src_info=bone_info(src)
print(json.dumps({**target_summary,'sourceObject':src.name,'sourceScale':list(src.scale),'sourceHips':src_info.get('Hips'),'sourceFoot':src_info.get('LeftFoot')},indent=2))
