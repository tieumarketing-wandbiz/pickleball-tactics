import bpy, json, math, os, sys
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TARGET = os.path.join(ROOT, 'tools', 'rig', 'out', 'human-rig.fixed.glb')
MAP = os.path.join(ROOT, 'assets-src', 'mixamo', 'clips-map.json')
OUT = os.path.join(ROOT, 'public', 'anim', 'locomotion.glb')
META = os.path.join(ROOT, 'tools', 'rig', 'anim', 'clips.json')
SHEET_DIR = os.path.join(ROOT, 'tools', 'rig', 'anim', 'sheets')
FPS = 30.0

def suffix(name): return name.split(':', 1)[-1]
def find_armature(): return next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
def bones_by_suffix(a): return {suffix(b.name): b for b in a.pose.bones}
def world_q(a, pb): return (a.matrix_world @ pb.matrix).to_quaternion()
def world_head(a, pb): return a.matrix_world @ pb.head
def capture_rest(a):
    bpy.context.view_layer.update()
    pbs = bones_by_suffix(a)
    data = {suffix(b.name): b for b in a.data.bones}
    # Pose bones retain the importer-applied pre-rotation; capture that exact
    # rest world frame so the first source sample transfers as identity.
    return {n: {'q': pb.rotation_quaternion.copy(), 'wq': (a.matrix_world @ pb.matrix).to_quaternion(), 'head': (a.matrix_world @ data[n].head_local).copy(), 'loc': pb.location.copy()} for n, pb in pbs.items() if n in data}
def clear_pose(a):
    for pb in a.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion((1,0,0,0)); pb.location = (0,0,0)
    bpy.context.view_layer.update()
def load_target():
    bpy.ops.import_scene.gltf(filepath=TARGET)
    a = find_armature(); a.animation_data_clear(); clear_pose(a)
    return a, capture_rest(a)
def import_source(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, use_prepost_rot=True)
    a = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o not in before)
    if not a.animation_data or not a.animation_data.action: raise RuntimeError(f'No action in {path}')
    return a
def frame_world(a, pb): return world_head(a, pb)
def set_source_frame(src, frame):
    bpy.context.scene.frame_set(frame); bpy.context.view_layer.update()
def qdelta(src_rest, src_q): return src_rest.inverted() @ src_q
def add_key(pb, frame):
    pb.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=pb.name)
def root_vertical_delta(src, src_rest, scale):
    p = frame_world(src, bones_by_suffix(src)['Hips'])
    # Imported FBX objects carry a +90deg X correction, so Blender Z is the
    # source's world-up axis after import.
    return (p.z - src_rest['Hips']['head'].z) * scale
def make_action(target, target_rest, source, source_rest, clip, mirror=False):
    start, end = clip['frames']; action = bpy.data.actions.new(clip['_id'])
    target.animation_data_create(); target.animation_data.action = action
    tp, sp = bones_by_suffix(target), bones_by_suffix(source)
    names = [n for n in target_rest if n in sp and n not in ('HeadTop_End',)]
    scale = 1.8
    vertical_scale = 0.13 if clip.get('_id') == 'hop' else 1.0
    src_hips0 = source_rest['Hips']['head']
    set_source_frame(source, start)
    src_hips_start = frame_world(source, sp['Hips'])
    set_source_frame(source, end)
    src_hips1 = frame_world(source, sp['Hips'])
    duration = max(1, end - start) / FPS
    root_vec = Vector((src_hips1.x-src_hips_start.x, src_hips1.y-src_hips_start.y, 0.0)) * scale
    ordered = sorted(names, key=lambda n: len(list(iter_parents(sp[n]))))
    for frame in range(int(start), int(end)+1):
        set_source_frame(source, frame)
        t = frame - start
        desired_world = {}
        for n in ordered:
            if n not in tp: continue
            delta = source_rest[n]['wq'].inverted() @ world_q(source, sp[n])
            # A Mixamo side mirror is represented by swapping the anatomical
            # bone names; the target runtime can apply the paired action.
            dest = n
            if mirror:
                dest = dest.replace('Left', '__S__', 1).replace('Right', 'Left', 1).replace('__S__', 'Right', 1)
                if dest not in tp: continue
            tp[dest].rotation_mode = 'QUATERNION'
            desired = target_rest[dest]['wq'] @ delta
            desired_world[dest] = desired
            # Assign the world frame directly. Blender converts it to the
            # target bone's local quaternion, including its rest orientation.
            # A rotated parent moves this child head. Preserve that evaluated
            # head location and change only the world orientation; assigning
            # the static rest head here would stretch the child bone.
            bpy.context.view_layer.update()
            posed_head = target.matrix_world @ tp[dest].head
            m = desired.to_matrix().to_4x4(); m.translation = posed_head
            tp[dest].matrix = target.matrix_world.inverted() @ m
            add_key(tp[dest], t)
        hips = tp['Hips']; hips.rotation_mode = 'QUATERNION'
        # Preserve vertical bob only; root horizontal travel becomes metadata.
        hips.location = (0.0, 0.0, root_vertical_delta(source, source_rest, scale * vertical_scale))
        hips.keyframe_insert(data_path='location', frame=t, group=hips.name)
    action.frame_start = 0; action.frame_end = int(end-start)
    return action, root_vec, duration
def iter_parents(pb):
    p = pb.parent
    while p:
        yield p
        p = p.parent
def camera_for(a):
    scene=bpy.context.scene; cd=bpy.data.cameras.get('MocapAuditCamera') or bpy.data.cameras.new('MocapAuditCamera'); cam=bpy.data.objects.get('MocapAuditCamera') or bpy.data.objects.new('MocapAuditCamera',cd)
    if cam.name not in scene.objects: scene.collection.objects.link(cam)
    cam.location=(0,-4,1.05); cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); cd.lens=48; scene.camera=cam
    return scene
def render_sheet(target, action, clip_id, start, end):
    scene=camera_for(target); scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=320; scene.render.resolution_y=420; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'; scene.world=bpy.data.worlds.new('MocapAuditWorld') if scene.world is None else scene.world; scene.world.color=(.04,.04,.04)
    os.makedirs(SHEET_DIR, exist_ok=True); frames=list(range(int(start), int(end)+1, max(1,int((end-start)/5))))[:6]
    frame_paths=[]
    for row,(loc,label) in enumerate([((0,-4,1.05),'front'),((4,0,1.05),'side')]):
        cam=bpy.data.objects.get('MocapAuditCamera'); cam.location=loc; cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler(); bpy.context.view_layer.update()
        for i,fr in enumerate(frames):
            scene.frame_set(fr); p=os.path.join(SHEET_DIR, f'{clip_id}-{label}-{i}.png'); scene.render.filepath=p; bpy.ops.render.render(write_still=True); frame_paths.append((label,p))
    # Combine the twelve renders into one review PNG inside Blender.
    w,h=320,420; sheet=bpy.data.images.new(f'{clip_id}-sheet', width=w*len(frames), height=h*2, alpha=False)
    pixels=[0.0]*(w*len(frames)*h*2*4)
    for label,p in frame_paths:
        im=bpy.data.images.load(p, check_existing=False); row=0 if label=='front' else 1; i=int(os.path.basename(p).rsplit('-',1)[1].split('.')[0]); src=list(im.pixels)
        for y in range(h):
            for x in range(w):
                si=(y*w+x)*4; di=((row*h+y)*(w*len(frames))+i*w+x)*4; pixels[di:di+4]=src[si:si+4]
        bpy.data.images.remove(im)
    sheet.pixels=pixels; sheet.filepath_raw=os.path.join(SHEET_DIR,f'{clip_id}.png'); sheet.file_format='PNG'; sheet.save(); bpy.data.images.remove(sheet)
    return os.path.join(SHEET_DIR,f'{clip_id}.png')
def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True); os.makedirs(os.path.dirname(META), exist_ok=True); os.makedirs(SHEET_DIR, exist_ok=True)
    with open(MAP, encoding='utf-8') as f: mapping=json.load(f)['clips']
    bpy.ops.wm.read_factory_settings(use_empty=True); target,target_rest=load_target(); meta=[]
    for cid, spec in mapping.items():
        path=os.path.join(ROOT,'assets-src','mixamo',spec['file']); source=import_source(path); source.animation_data.action=next(iter([a for a in bpy.data.actions if a.name == source.animation_data.action.name]), source.animation_data.action)
        # capture the source edit/rest pose with no action applied
        act=source.animation_data.action; source.animation_data.action=None; bpy.context.scene.frame_set(0); source_rest=capture_rest(source); source.animation_data.action=act
        clip=dict(spec); clip['_id']=cid
        action,root_vec,duration=make_action(target,target_rest,source,source_rest,clip)
        sheet=render_sheet(target,action,cid,0,int(spec['frames'][1]-spec['frames'][0]))
        meta.append({'id':cid,'frames':[0,int(spec['frames'][1]-spec['frames'][0])],'duration':duration,'fps':FPS,'loop':bool(spec.get('loop',False)),'rootSpeed':round(root_vec.length/duration,5),'rootDir':[round(root_vec.x/(root_vec.length or 1),5),round(root_vec.y/(root_vec.length or 1),5)],'mirrored':False,'sourceFile':spec['file'],'contactSheet':os.path.relpath(sheet, ROOT).replace('\\','/')})
        bpy.data.objects.remove(source, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); target.select_set(True); bpy.context.view_layer.objects.active=target
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_animations=True, export_animation_mode='ACTIONS', export_skins=False, export_materials='PLACEHOLDER', use_selection=True)
    with open(META,'w',encoding='utf-8') as f: json.dump({'version':1,'fps':FPS,'clips':meta},f,indent=2)
    print(json.dumps({'output':OUT,'metadata':META,'clips':len(meta),'sheets':len(meta)},indent=2))
if __name__=='__main__': main()
