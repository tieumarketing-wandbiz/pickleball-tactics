# Task `sol` — demo: author ONE stroke as keyframed animation in Blender (by Python), ship it to the web

The user wants to compare: **animation keyed in Blender by code** vs the app's procedural animation. Make one clean
demo of a shot the app hasn't done properly yet: the **forehand drive** (right-handed, from the baseline).

## Owned files (new, nobody else touches them)
`tools/rig/anim/*` (scripts, renders), `public/anim/drive.glb`, `src/debug/anim-viewer.html`, `src/debug/anim-viewer.ts`.

## Steps
1. Rig: use your fixed rig (`tools/rig/out/human-rig.fixed.glb`) if it validates, else `tools/rig/source/human-rig.glb`
   normalized the same way (app space: 1.8 m, faces −Z). Paddle: a simple paddle object parented to `RightHand` with a
   proper grip offset; fingers curled around the handle (finger bones), thumb opposed.
2. Author the drive in Blender Python as **pose-to-pose keys** (not per-frame), 24 fps, following
   `.agents/reference/animation-principles.md` and the drive rows of `technique-research.md` (§A drive, §C, §E):
   `ready` → split step → `anticipation` (unit turn, weight to the back foot) → `load` (paddle back at hip height, face
   slightly closed/neutral, hips ~45°, shoulders ~90° turned) → `breakdown` (hips open first, paddle lagging, low-to-high
   arc) → `contact` (in front of the front hip, ~waist height, arm extended, face square) → `follow` (paddle finishes
   over the opposite shoulder, chest facing the net, back heel up) → `settle` (5–10 % overshoot) → `ready`.
   Use Bézier F-curves with deliberate easing (slow-in/slow-out at extremes, accelerating into contact), kinetic-chain
   offsets (hips → chest → upper arm → forearm → hand → paddle, a few frames apart), arcs for the paddle tip, off arm
   counterbalancing (points forward on the turn, tucks in on the follow), head tracking the ball, weight shift with knee
   bend, feet planted (no sliding) — **arms clear of the torso at every frame**, no wrist over 60°, elbows 25–160°.
   Total ≈ 1.6–2.0 s, loopable (ends in the same ready pose).
3. Check it: render a contact sheet (every 2nd frame, front + side, Workbench) to `tools/rig/anim/drive-sheet-*.png`,
   look at it, fix arms/feet/arcs until it reads well. Also print paddle-tip world positions per frame and confirm the
   speed peaks at contact and there are no velocity jumps.
4. Export `public/anim/drive.glb`: the skinned character + paddle + the action, 24 fps, sampled animation, only
   deform bones, ≤ 4 influences. Compress if easy (gltf-transform `resample` + `meshopt`; decoder already in the app).
5. Viewer: `src/debug/anim-viewer.html` + `.ts` (served by the running dev server at
   http://localhost:5173/src/debug/anim-viewer.html — do NOT start/kill servers): load the GLB with GLTFLoader +
   MeshoptDecoder, play the clip with AnimationMixer in a loop, render at **24 fps**, OrbitControls, a ground grid and a
   simple court-colored floor, buttons: play/pause, step frame ±1, speed 0.25×/1×, show/hide skeleton. Keep it tiny.
6. Status: `.agents/status/sol.md` — files, clip length, size, what principles were applied where (frame numbers), and
   paths of 3–4 contact-sheet images that show it best.
