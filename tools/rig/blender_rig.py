"""Stage A: normalize and audit the user-supplied Mixamo rig."""
import bpy, json, math, os, sys
from mathutils import Vector, Matrix, Quaternion, kdtree

SOURCE = "tools/rig/source/human-rig.glb"
OUT = "tools/rig/out/human-rig.fixed.glb"
POSE_SNAPSHOTS = {}

def args():
    vals = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    def get(name, default): return vals[vals.index(name) + 1] if name in vals else default
    return os.path.abspath(get("--in", SOURCE)), os.path.abspath(get("--out", OUT))

def clear_scene():
    if bpy.context.object and bpy.context.object.mode != "OBJECT": bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)

def imported_objects(path):
    bpy.ops.import_scene.gltf(filepath=path)
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if len(armatures) != 1 or not meshes: raise RuntimeError(f"expected one armature and mesh, got {len(armatures)} / {len(meshes)}")
    # Tripo exports a hidden duplicate/helper mesh in some revisions.  The
    # skinned mesh is the one with the armature modifier and vertex groups.
    skinned = [m for m in meshes if any(mod.type == "ARMATURE" for mod in m.modifiers)]
    mesh = max(skinned or meshes, key=lambda m: len(m.data.vertices))
    for extra in meshes:
        if extra != mesh: extra.hide_render = True
    modifiers = [m for m in mesh.modifiers if m.type == "ARMATURE"]
    if not modifiers:
        raise RuntimeError("selected mesh has no Armature modifier")
    for modifier in modifiers:
        modifier.object = armatures[0]
        modifier.show_viewport = True
        modifier.show_render = True
    return armatures[0], mesh

def world_points(mesh): return [mesh.matrix_world @ v.co for v in mesh.data.vertices]
def bounds(points): return {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]}
def suffix(name): return name.split(":", 1)[-1]

def normalize(armature, mesh):
    # Blender import is Z-up: source vertical is Z, lateral is Y, and the
    # source front is -X. Rz(-90) is the established app-space transform for
    # the shipped glTF contract; review cameras account for the human-facing
    # side separately.
    before = world_points(mesh); min_z, max_z = min(p.z for p in before), max(p.z for p in before)
    scale = 1.8 / (max_z - min_z); min_y, max_y = min(p.y for p in before), max(p.y for p in before); center_y = (min_y + max_y) * 0.5
    transform = Matrix.Scale(scale, 4) @ Matrix.Rotation(-math.pi / 2.0, 4, "Z") @ Matrix.Translation(Vector((0.0, -center_y, -min_z)))
    for obj in (armature, mesh): obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()
    for obj in (armature, mesh):
        bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True); bpy.context.view_layer.objects.active = obj; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()
    return {"scale": scale, "rotationZDegrees": -90.0, "beforeBounds": bounds(before), "afterBounds": bounds(world_points(mesh)), "blenderUpAxis": "Z", "appFacing": "-Z"}

def weld_mesh(mesh):
    before = len(mesh.data.vertices)
    bpy.ops.object.select_all(action="DESELECT"); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    try: bpy.ops.mesh.remove_doubles(threshold=1e-5)
    except TypeError: bpy.ops.mesh.remove_doubles(threshold=1e-5, use_unselected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return before, len(mesh.data.vertices)

def prune_unweighted_leaves(armature, mesh):
    weighted_names = set()
    for group in mesh.vertex_groups:
        for vert in mesh.data.vertices:
            try:
                if group.weight(vert.index) > 1e-6: weighted_names.add(group.name); break
            except RuntimeError: pass
    leaves = [b for b in armature.data.bones if not b.children and b.name not in weighted_names]
    candidates = [b for b in leaves if suffix(b.name).endswith(("4", "Toe_End", "HeadTop_End"))]
    before, removed = len(armature.data.bones), [b.name for b in candidates]
    if candidates:
        bpy.context.view_layer.objects.active = armature; bpy.ops.object.select_all(action="DESELECT"); armature.select_set(True); bpy.ops.object.mode_set(mode="EDIT")
        for b in list(armature.data.edit_bones):
            if b.name in removed: armature.data.edit_bones.remove(b)
        bpy.ops.object.mode_set(mode="OBJECT")
    return before, len(armature.data.bones), removed, sorted(weighted_names)

def normalize_weights(mesh):
    maximum, sums = 0, []
    for vert in mesh.data.vertices:
        entries = sorted(((g.group, g.weight) for g in vert.groups if g.weight > 1e-8 and g.group < len(mesh.vertex_groups)), key=lambda x: x[1], reverse=True)[:4]
        total = sum(w for _, w in entries)
        if not entries or total <= 1e-10: raise RuntimeError(f"vertex {vert.index} has no positive skin weight")
        keep = {group for group, _ in entries}
        for group, weight in entries: mesh.vertex_groups[group].add([vert.index], weight / total, "REPLACE")
        for group in mesh.vertex_groups:
            if group.index not in keep: group.add([vert.index], 0.0, "REPLACE")
        maximum = max(maximum, len(entries)); sums.append(1.0)
    return maximum, min(sums), max(sums)

def weight_map(vertex, groups):
    return {groups[g.group].name: g.weight for g in vertex.groups if g.group < len(groups) and g.weight > 1e-8}

def audit_weights(mesh):
    groups = list(mesh.vertex_groups)
    trunk = ("mixamorig:Hips", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Neck")
    arm = ("mixamorig:LeftArm", "mixamorig:RightArm")
    clav = ("mixamorig:LeftShoulder", "mixamorig:RightShoulder")
    distal = ("mixamorig:LeftForeArm", "mixamorig:RightForeArm", "mixamorig:LeftHand", "mixamorig:RightHand")
    counts = {"trunkUpperArm": 0, "trunkUpperArmArmSideBelowArmpit": 0, "clavicleTrunk": 0, "clavicleUpperArm": 0, "distalUpperArm": 0, "illegalLeftRight": 0}
    for v in mesh.data.vertices:
        w = weight_map(v, groups); p = mesh.data.vertices[v.index].co
        has_trunk = any(w.get(n, 0) > .02 for n in trunk); has_arm = any(w.get(n, 0) > .02 for n in arm)
        has_clav = any(w.get(n, 0) > .02 for n in clav); has_distal = any(w.get(n, 0) > .02 for n in distal)
        if has_trunk and has_arm:
            counts["trunkUpperArm"] += 1
            matching_arm = (p.y > .08 and w.get("mixamorig:RightArm", 0) > .02) or (p.y < -.08 and w.get("mixamorig:LeftArm", 0) > .02)
            if matching_arm and p.z < .78: counts["trunkUpperArmArmSideBelowArmpit"] += 1
        if has_clav and has_trunk: counts["clavicleTrunk"] += 1
        if has_clav and has_arm: counts["clavicleUpperArm"] += 1
        if has_distal and has_arm: counts["distalUpperArm"] += 1
        left = any(n.startswith("mixamorig:Left") and w.get(n, 0) > .02 for n in w); right = any(n.startswith("mixamorig:Right") and w.get(n, 0) > .02 for n in w)
        if left and right: counts["illegalLeftRight"] += 1
    return counts

def flip_name(name):
    return name.replace("Left", "__SIDE__", 1).replace("Right", "Left", 1).replace("__SIDE__", "Right", 1)

def mirror_weights(mesh, lateral=1, tol=.01):
    verts = mesh.data.vertices; kd = kdtree.KDTree(len(verts))
    for v in verts: kd.insert(v.co, v.index)
    kd.balance(); groups = {g.name: g for g in mesh.vertex_groups}; names = {g.index: g.name for g in mesh.vertex_groups}; misses = 0; copied = 0
    # Source side is Blender +Y (character left); write the -Y destination.
    for v in verts:
        if v.co[lateral] >= -1e-3: continue
        mirrored = v.co.copy(); mirrored[lateral] *= -1
        _, j, dist = kd.find(mirrored)
        if dist > tol: misses += 1; continue
        source = {flip_name(names[g.group]): g.weight for g in verts[j].groups if g.group in names and names[g.group].startswith("mixamorig:")}
        for g in list(v.groups):
            mesh.vertex_groups[g.group].remove([v.index])
        for name, weight in source.items():
            if name in groups: groups[name].add([v.index], weight, "REPLACE")
        copied += 1
    return copied, misses

def clean_arm_trunk(mesh):
    groups = {g.name: g for g in mesh.vertex_groups}; trunk = ("mixamorig:Hips", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2", "mixamorig:Neck")
    arm = ("mixamorig:LeftArm", "mixamorig:RightArm")
    fixed = 0
    for v in mesh.data.vertices:
        # Called before normalization, while the source remains Blender Z-up.
        p = v.co; side = abs(p.y) > .08 and p.z < .78
        if not side: continue
        matching = "mixamorig:RightArm" if p.y > .08 else "mixamorig:LeftArm"
        arm_w = next((g.weight for g in v.groups if g.group == groups[matching].index), 0) if matching in groups else 0
        if arm_w <= .02: continue
        for n in trunk:
            g = groups.get(n)
            if g:
                try: g.remove([v.index])
                except RuntimeError: pass
        fixed += 1
    return fixed

def apply_shoulder_gradient(mesh):
    """Blend Spine2 -> Shoulder -> Arm through the source armpit band."""
    groups = {g.name: g for g in mesh.vertex_groups}
    trunk_names = ("mixamorig:Spine2", "mixamorig:Spine1", "mixamorig:Spine")
    changed = 0
    for v in mesh.data.vertices:
        p = v.co
        side = 1 if p.y > 0.07 else -1 if p.y < -0.07 else 0
        if side == 0 or not (0.66 <= p.z <= 0.98):
            continue
        side_name = "Right" if side > 0 else "Left"
        shoulder = groups.get(f"mixamorig:{side_name}Shoulder")
        arm = groups.get(f"mixamorig:{side_name}Arm")
        if shoulder is None or arm is None:
            continue
        weights = {}
        for g in mesh.vertex_groups:
            try:
                weights[g.name] = g.weight(v.index)
            except RuntimeError:
                pass
        trunk_w = sum(weights.get(n, 0.0) for n in trunk_names)
        side_w = weights.get(shoulder.name, 0.0) + weights.get(arm.name, 0.0)
        if trunk_w <= 0.02 and side_w <= 0.02:
            continue
        t = max(0.0, min(1.0, (p.z - 0.66) / 0.32))
        transfer = min(trunk_w * (0.10 + 0.08 * t), 0.12)
        if transfer <= 1e-6:
            continue
        for n in trunk_names:
            g = groups.get(n)
            if not g:
                continue
            old = weights.get(n, 0.0)
            if old > 0:
                g.add([v.index], max(0.0, old - transfer * old / trunk_w), "REPLACE")
        shoulder.add([v.index], weights.get(shoulder.name, 0.0) + transfer * (1.0 - t), "REPLACE")
        arm.add([v.index], weights.get(arm.name, 0.0) + transfer * t, "REPLACE")
        changed += 1
    return changed

def bone_world_positions(armature):
    bpy.context.view_layer.update(); wanted = {"Hips", "LeftArm", "LeftHand", "LeftUpLeg", "LeftFoot", "RightHand"}; result = {}
    for b in armature.data.bones:
        if suffix(b.name) in wanted: result[suffix(b.name)] = list((armature.matrix_world @ b.head_local))
    return result

def asymmetry(mesh):
    points = [mesh.matrix_world @ v.co for v in mesh.data.vertices]; pairs = []
    for i, p in enumerate(points):
        j = min(range(len(points)), key=lambda k: (points[k].x + p.x) ** 2 + (points[k].y - p.y) ** 2 + (points[k].z - p.z) ** 2)
        if j != i: pairs.append((i, j))
    groups = {g.name: g for g in mesh.vertex_groups}; metrics = {}
    for left in groups:
        right = left.replace("Left", "Right", 1)
        if not left.startswith("mixamorig:Left") or right not in groups: continue
        values = []
        for i, j in pairs:
            try: lw = groups[left].weight(i)
            except RuntimeError: lw = 0.0
            try: rw = groups[right].weight(j)
            except RuntimeError: rw = 0.0
            values.append(abs(lw - rw))
        if values: metrics[f"{left}|{right}"] = sum(values) / len(values)
    return metrics, (sum(metrics.values()) / len(metrics) if metrics else 0.0)

def set_pose(armature, kind):
    # Remove helpers/constraints from the previous audit pose.
    for bone in armature.pose.bones:
        for constraint in list(bone.constraints):
            if constraint.type == "IK" and constraint.name.startswith("RigAudit"):
                bone.constraints.remove(constraint)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("RigAuditTarget") or obj.name.startswith("RigAuditPole"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
    def rot(name, angle, axis=(1, 0, 0)):
        b = next((b for b in armature.pose.bones if suffix(b.name) == name), None)
        if not b: return
        b.rotation_mode = "XYZ"
        # The imported armature uses arbitrary rolls, but XYZ here means the
        # bone's own local axes and is the reliable Blender pose API path.
        if axis == (1, 0, 0): b.rotation_euler = (angle, 0.0, 0.0)
        elif axis == (0, 1, 0): b.rotation_euler = (0.0, angle, 0.0)
        else: b.rotation_euler = (0.0, 0.0, angle)
    if kind in ("ready", "deep-dink"):
        rot("LeftArm", -0.22, (0, 0, 1)); rot("RightArm", 0.22, (0, 0, 1)); rot("LeftForeArm", -0.45); rot("RightForeArm", -0.45)
    elif kind == "wide-lunge": rot("LeftArm", -0.55, (0, 0, 1)); rot("LeftForeArm", -0.3)
    elif kind == "smash": rot("RightArm", -0.85, (0, 0, 1)); rot("RightForeArm", 0.4); rot("LeftArm", -0.65, (0, 0, 1)); rot("Spine", 0.18); rot("Spine1", 0.18)
    elif kind == "trunk-turn": rot("Hips", 0.18, (0, 1, 0)); rot("Spine", 0.22, (0, 1, 0)); rot("Spine1", 0.22, (0, 1, 0)); rot("Spine2", 0.22, (0, 1, 0))
    elif kind == "pronation": rot("RightForeArm", 0.8, (0, 1, 0)); rot("RightHand", 0.3, (1, 0, 0))
    elif kind == "fist-grip":
        for bone in armature.pose.bones:
            if suffix(bone.name).startswith("RightHand") and suffix(bone.name)[-1:].isdigit():
                bone.rotation_mode = "QUATERNION"
                # The Mixamo finger hinge is not a fixed XYZ axis.  The
                # geometric curl axis is filled in below after the hand frame.
                bone.rotation_quaternion = Quaternion((1, 0, 0), -0.1)
    if kind in ("ready", "deep-dink", "wide-lunge", "smash"):
        ik_targets = {
            "ready": ((-0.27, -0.24, 1.28), (0.27, -0.24, 1.28)),
            "deep-dink": ((-0.30, -0.30, 1.08), (0.30, -0.30, 1.08)),
            "wide-lunge": ((-0.57, -0.22, 1.05), (0.34, -0.28, 1.22)),
            "smash": ((-0.05, -0.10, 1.78), (0.16, -0.10, 1.92)),
        }[kind]
        for side, target_position in (("Left", ik_targets[0]), ("Right", ik_targets[1])):
            target = bpy.data.objects.new("RigAuditTarget" + side, None); bpy.context.scene.collection.objects.link(target); target.empty_display_type = "SPHERE"; target.empty_display_size = .03; target.location = target_position
            pole = bpy.data.objects.new("RigAuditPole" + side, None); bpy.context.scene.collection.objects.link(pole); pole.empty_display_type = "CUBE"; pole.empty_display_size = .02; pole.location = (target_position[0], target_position[1] - .35, target_position[2] - .20)
            hand = next(b for b in armature.pose.bones if suffix(b.name) == side + "Hand")
            constraint = hand.constraints.new("IK"); constraint.name = "RigAuditIK" + side; constraint.target = target; constraint.pole_target = pole; constraint.chain_count = 3; constraint.pole_angle = 0.0
    if kind in ("ready", "deep-dink", "wide-lunge"):
        hips = next((b for b in armature.pose.bones if suffix(b.name) == "Hips"), None)
        if hips:
            # Hips local +Y is Blender world +Z on this imported hierarchy.
            hips.location.y = {"ready": -0.045, "deep-dink": -0.22, "wide-lunge": -0.10}[kind]
        foot_targets = {
            "ready": ((-0.25, -0.01, 0.025), (0.25, 0.01, 0.025)),
            "deep-dink": ((-0.27, -0.04, 0.025), (0.27, 0.04, 0.025)),
            "wide-lunge": ((-0.58, -0.16, 0.025), (0.34, 0.14, 0.025)),
        }[kind]
        for side, target_position in (("Left", foot_targets[0]), ("Right", foot_targets[1])):
            target = bpy.data.objects.new("RigAuditTargetFoot" + side, None); bpy.context.scene.collection.objects.link(target); target.empty_display_type = "SPHERE"; target.empty_display_size = .035; target.location = target_position
            pole = bpy.data.objects.new("RigAuditPoleFoot" + side, None); bpy.context.scene.collection.objects.link(pole); pole.empty_display_type = "CUBE"; pole.empty_display_size = .025; pole.location = (target_position[0], target_position[1] - .50, target_position[2] + .45)
            foot = next(b for b in armature.pose.bones if suffix(b.name) == side + "Foot")
            constraint = foot.constraints.new("IK"); constraint.name = "RigAuditIKFoot" + side; constraint.target = target; constraint.pole_target = pole; constraint.chain_count = 3; constraint.pole_angle = 0.0
    if kind == "pronation":
        forearm = next(b for b in armature.pose.bones if suffix(b.name) == "RightForeArm")
        hand = next(b for b in armature.pose.bones if suffix(b.name) == "RightHand")
        forearm.rotation_mode = "QUATERNION"; forearm.rotation_quaternion = Quaternion((0, 1, 0), 1.25)
        hand.rotation_mode = "QUATERNION"; hand.rotation_quaternion = Quaternion((1, 0, 0), 0.75)
    if kind == "fist-grip":
        # Curl around the rest knuckle line, converted into each phalanx's
        # local frame. This works with Tripo's arbitrary finger rolls.
        bones = {suffix(b.name): b for b in armature.data.bones}
        index = bones.get("RightHandIndex1"); pinky = bones.get("RightHandPinky1")
        if index and pinky:
            hinge_world = (pinky.head_local - index.head_local).normalized()
            for bone in armature.pose.bones:
                name = suffix(bone.name)
                if not (name.startswith("RightHand") and name[-1:].isdigit()): continue
                rest_q = bones[name].matrix_local.to_quaternion()
                hinge_local = hinge_world.copy(); hinge_local.rotate(rest_q.inverted())
                bone.rotation_mode = "QUATERNION"; bone.rotation_quaternion = Quaternion(hinge_local, -0.85)
    bpy.context.view_layer.update()

def pose_snapshot(armature, kind):
    bpy.context.view_layer.update()
    wanted = ("LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot")
    result = {}
    for bone in armature.pose.bones:
        if suffix(bone.name) not in wanted: continue
        head = armature.matrix_world @ bone.head
        tail = armature.matrix_world @ bone.tail
        result[suffix(bone.name)] = {"head": [round(x, 5) for x in head], "tail": [round(x, 5) for x in tail]}
    print("POSE", kind, json.dumps(result, separators=(",", ":")))
    if kind == "smash":
        hand = result.get("RightHand", {}).get("head", [0, 0, 0])
        head = next((armature.matrix_world @ b.head for b in armature.pose.bones if suffix(b.name) == "Head"), Vector())
        print("POSE smash right-hand-z-minus-head-z", round(hand[2] - head.z, 5))
    return result

def clear_audit_pose(armature):
    for bone in armature.pose.bones:
        for constraint in list(bone.constraints):
            if constraint.name.startswith("RigAudit"):
                bone.constraints.remove(constraint)
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("RigAuditTarget") or obj.name.startswith("RigAuditPole"):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()

def render_pose(armature, path, kind, view):
    set_pose(armature, kind); snapshot = pose_snapshot(armature, kind); POSE_SNAPSHOTS[f"{kind}-{view}"] = snapshot; scene = bpy.context.scene; cd = bpy.data.cameras.get("RigAuditCamera") or bpy.data.cameras.new("RigAuditCamera"); camera = bpy.data.objects.get("RigAuditCamera") or bpy.data.objects.new("RigAuditCamera", cd)
    if camera.name not in scene.objects: scene.collection.objects.link(camera)
    # The normalized Blender asset faces -Y; cameras stay horizontal at chest height.
    scene.camera = camera; camera.location = (0, -4, 1.15) if view == "front" else (4, 0, 1.15); camera.rotation_euler = (Vector((0, 0, 0.9)) - camera.location).to_track_quat("-Z", "Y").to_euler(); cd.lens = 48
    scene.render.engine = "BLENDER_WORKBENCH"; scene.render.resolution_x = 800; scene.render.resolution_y = 800; scene.render.resolution_percentage = 100; scene.render.image_settings.file_format = "PNG"; scene.render.filepath = path; scene.display.shading.light = "STUDIO"; scene.display.shading.color_type = "MATERIAL"; scene.world.color = (0.04, 0.04, 0.04); bpy.ops.render.render(write_still=True)

def export(armature, mesh, path):
    bpy.ops.object.select_all(action="DESELECT"); armature.select_set(True); mesh.select_set(True); bpy.context.view_layer.objects.active = armature; os.makedirs(os.path.dirname(path), exist_ok=True); bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_animations=False, export_skins=True, export_morph=False, export_materials="PLACEHOLDER", use_selection=True)

def main():
    source, output = args(); out_dir = os.path.dirname(output); os.makedirs(out_dir, exist_ok=True); poses = ("ready", "deep-dink", "wide-lunge", "smash", "trunk-turn", "pronation", "fist-grip")
    # Pass 1: normalized source with untouched Tripo weights for baseline renders.
    clear_scene(); armature, mesh = imported_objects(source); asym_before_raw, asym_mean_before_raw = asymmetry(mesh); audit_before_raw = audit_weights(mesh); transform_before = normalize(armature, mesh); weld_before = weld_mesh(mesh); prune_before = prune_unweighted_leaves(armature, mesh)
    for pose in poses:
        for view in ("front", "side"): render_pose(armature, os.path.join(out_dir, f"v2-{pose}-before-{view}.png"), pose, view)
    # Pass 2: reload source so the mirror uses its measured Blender-Y axis.
    clear_scene(); armature, mesh = imported_objects(source); asym_before, asym_mean_before = asymmetry(mesh); audit_before = audit_weights(mesh); mirror = mirror_weights(mesh, lateral=1, tol=.01); arm_fixed = clean_arm_trunk(mesh); shoulder_gradient = apply_shoulder_gradient(mesh); transform = normalize(armature, mesh); weld = weld_mesh(mesh); prune = prune_unweighted_leaves(armature, mesh); max_inf, min_sum, max_sum = normalize_weights(mesh); asym_after, asym_mean_after = asymmetry(mesh); audit_after = audit_weights(mesh)
    for pose in poses:
        for view in ("front", "side"): render_pose(armature, os.path.join(out_dir, f"v2-{pose}-after-{view}.png"), pose, view)
    clear_audit_pose(armature); export(armature, mesh, output)
    report = {"version": "v2", "input": source, "output": output, "transform": transform, "baselineTransform": transform_before, "weld": {"before": weld[0], "after": weld[1]}, "jointCountBeforePrune": prune[0], "jointCountAfterPrune": prune[1], "prunedUnweightedLeaves": prune[2], "weightedBones": prune[3], "maxInfluences": max_inf, "weightSumRange": [min_sum, max_sum], "weightFixes": {"kdTreeMirror": {"copied": mirror[0], "misses": mirror[1], "lateralAxis": "Blender Y on source"}, "armTrunkVerticesCleaned": arm_fixed, "shoulderGradientVertices": shoulder_gradient, "pipeline": ["source-space targeted trunk/upper-arm cleanup below armpit", "source-space KD-tree mirror", "Spine2-Shoulder-Arm armpit gradient", "weld seams", "Limit Total 4", "Normalize All"]}, "audit": {"before": audit_before_raw, "after": audit_after, "rawBeforeFix": audit_before}, "lrAsymmetry": {"before": asym_mean_before_raw, "beforeByBone": asym_before_raw, "after": asym_mean_after, "afterByBone": asym_after}, "jointRestWorldPositions": bone_world_positions(armature), "poseSnapshots": POSE_SNAPSHOTS, "camera": {"front": "Blender -Y looking toward face/chest", "side": "Blender +X"}, "poses": {p: {"before": [f"v2-{p}-before-front.png", f"v2-{p}-before-side.png"], "after": [f"v2-{p}-after-front.png", f"v2-{p}-after-side.png"]} for p in poses}, "notes": "Before renders use untouched Tripo weights. After renders use source-space KD-tree mirroring, targeted arm-side trunk cleanup, and a Spine2-Shoulder-Arm gradient before app normalization. Pose snapshots are captured after IK/pose evaluation and before each render."}
    with open(os.path.join(out_dir, "rig-report.json"), "w", encoding="utf-8") as f: json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))

if __name__ == "__main__": main()
