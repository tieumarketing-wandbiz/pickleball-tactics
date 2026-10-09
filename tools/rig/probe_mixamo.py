import bpy, json, sys, os

path = os.path.abspath(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else os.path.abspath('assets-src/mixamo/Ready Idle.fbx')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, use_prepost_rot=True)
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
actions = []
for a in bpy.data.actions:
    actions.append({'name': a.name, 'frames': list(a.frame_range), 'layers': len(a.layers), 'slots': len(a.slots)})
result = {
    'file': path,
    'objects': [{'name': o.name, 'type': o.type, 'scale': list(o.scale), 'location': list(o.location)} for o in bpy.context.scene.objects],
    'armatures': [{'name': a.name, 'bones': len(a.data.bones), 'poseBones': len(a.pose.bones), 'action': a.animation_data.action.name if a.animation_data and a.animation_data.action else None, 'names': [b.name for b in a.data.bones[:12]]} for a in arms],
    'actions': actions,
}
print(json.dumps(result, indent=2))
