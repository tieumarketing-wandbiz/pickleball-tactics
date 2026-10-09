# Task `sol` — M3a: retarget the user's Mixamo clips onto the user's rig (Blender, MCP + CLI)

Read `.agents/tasks/mocap-pipeline.md` first. Inputs: `assets-src/mixamo/*.fbx` (user-downloaded, Without Skin, 30 fps,
65 `mixamorig` bones, armature object scale 0.01 = cm units) and the mapping `assets-src/mixamo/clips-map.json`
(ids, frame ranges, notes). Target rig: your fixed rig `tools/rig/out/human-rig.fixed.glb` (app space: 1.8 m, faces −Z,
A-pose rest, 52 joints) — or the shipped `public/models/male-rigged.glb` if yours isn't final.
Raw FBX files must never be committed or shipped (Mixamo terms); only the processed GLB ships.

## Steps
1. For each clip in `clips-map.json`: import the FBX, verify the bone names match the target (same Mixamo names), fix
   the unit scale (cm → m) and orientation so it matches app space.
2. **Retarget by world rotations**, not raw local keys: Mixamo clips are authored on a T-pose rest, the target rests in
   an A-pose, so copy each bone's world-space rotation delta relative to its own rest (or use Copy Rotation constraints
   in world space + bake), then bake to the target armature. Hips: copy rotation; translation scaled by the leg-length
   ratio (target hip height / source hip height).
3. **Root motion**: strip horizontal (XZ) hips translation so clips are in place, keep the vertical bob; store the
   average horizontal root speed (m/s) and direction in the clip's `extras.rootSpeed` / `extras.rootDir`.
4. Clean-up: foot locking on contacts (no sliding when the foot is planted), loop seams for `loop: true` clips (first ==
   last pose, matching velocities), light jitter filter. `shuffle`: render it first — if it is a dance, drop it and say so.
   `hop`: keep only a short split-step dip/hop (~0.05–0.08 m). Mirror the side/diagonal clips for the other side.
5. Render a contact sheet per clip (every 3rd frame, front + side) into `tools/rig/anim/sheets/<id>.png`, LOOK at them,
   fix feet/hands/arms before exporting. Arms must not intersect the torso.
6. Export one animation GLB `public/anim/locomotion.glb` (armature + actions only, no mesh, or with the mesh if the
   three.js loader needs it — say which), resample to 30 fps, quantize + meshopt (gltf-transform; MeshoptDecoder is
   already in the app). Write `tools/rig/anim/clips.json`: id, frames, duration, loop, rootSpeed, rootDir, mirrored,
   source file.
7. Status: `.agents/status/sol.md` — sizes, clip list, the 3–4 contact sheets that show it best, problems.
