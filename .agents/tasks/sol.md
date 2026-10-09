# Task `sol` — Stage A v2: audit + fix the user's Mixamo rig in Blender (Codex · GPT-6.1-Sol, high)

Read `.agents/README.md` (v2 contract), `.agents/reference/rig-guide.md` (if present — web research on weight painting /
Mixamo), `.agents/reference/video-guide.md` ("Implications for the rig") and `.agents/reference/animation-principles.md` §3.
Your files: `tools/rig/blender_rig.py`, `tools/rig/out/*`. Status: `.agents/status/sol.md`.
Your earlier v1 work (generating a 19-bone armature) is obsolete; reuse only what helps. Its renders showed detached
fingers, candy-wrapped forearms and L/R asymmetry — do not repeat that.

## Input / output
In: `tools/rig/source/human-rig.glb` (read-only, user-made; Mixamo names, Tripo weights, 1.0 m, faces −X, A-pose).
Out: `tools/rig/out/human-rig.fixed.glb` + `tools/rig/out/rig-report.json` + review renders `tools/rig/out/v2-*.png`.

## Steps
1. **Normalize** to app space (contract item 1): uniform scale ×1.8, rotate −90° about world +Y so the character faces −Z
   (left hand ends up at −X), feet at y = 0, bbox x-center 0. Apply transforms to armature + mesh (rest pose updated,
   nothing left on object transforms). Verify after re-import: height 1.8 ± 1e-3, `LeftHand.x < 0`, toes toward −Z.
2. **Prune** the 13 unweighted leaf end bones only if they have no weight (check; report).
3. **Audit the weights** by posing the armature (pose mode, no keyframes needed) into these test poses and rendering each
   from front and side (Workbench, 800×800 is fine):
   ready (knees 35°, elbows ~90° and 0.15–0.25 m off the ribs, hands at sternum), deep dink squat (knees ~90°, hip hinge
   40°), wide lunge (stance 2.5× shoulders, trailing leg straight), smash (hitting arm fully overhead, off arm at ~150°
   shoulder flexion), trunk turn (45–60° spine twist distributed over Spine/Spine1/Spine2), forearm pronation 90° with
   wrist flexion 30°, fist/grip (all fingers curled ~70–90° per phalanx, thumb opposed).
   Look for: armpit/shoulder collapse, chest/back pinching, groin/hip tearing, knee collapse, candy-wrapping at the wrist,
   finger verts pulled by the wrong finger or the palm, L/R asymmetry, verts influenced by far bones (e.g. hand weights on
   the thigh in A-pose).
4. **Fix** what you find with Blender Python: X-mirror symmetrize weights (fix the worse side from the better side),
   Smooth Vertex Weights on problem groups, forearm gradient ForeArm→Hand to spread twist, remove stray influences from
   distant bones, Limit Total 4, Normalize All. Do not rename/re-parent bones or change rest positions.
   Prefer targeted fixes over re-binding; if a region is hopeless, re-weight just that region (e.g. bone heat on a
   selected vertex subset) and say so.
5. **Export** glTF binary: armature + one skinned mesh, deform bones only, no animations, no UVs needed (luna drops them anyway), Y-up.

## Report (`rig-report.json` + status file)
Transform applied; joint count before/after prune; per-pose issues found and fixed (before/after renders `v2-<pose>-before.png`
/ `v2-<pose>-after.png`); max influences; weight-sum range; L/R asymmetry metric (mean |w(v) − w(mirror(v))| per bone pair)
before/after; joint rest world positions of Hips, LeftArm, LeftHand, LeftUpLeg, LeftFoot, RightHand in app space.
Then run `npx vite-node tools/rig/validate.ts tools/rig/out/human-rig.fixed.glb --raw` once luna has upgraded it to v2.
