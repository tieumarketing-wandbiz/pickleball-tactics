# Rig pipeline — multi-agent board (v2: user-supplied Mixamo rig)

Project root: `D:\AI\Code\Tieu\pickleball-tactics-main` (Vite + TS + Three.js, no git).
Coordinator: Claude (Opus 5.5) in the Claude desktop app. CLI agents do the work, launched headless by the coordinator.
Backup of the original sources: `D:/AI/Code/Tieu/.backup-pickleball-2026-10-08/` (outside the project; do not edit).

## What changed in v2 (2026-10-08, read this first)
The user built the skeleton by hand: **`tools/rig/source/human-rig.glb`** — a **Mixamo-standard** armature
(65 joints, `mixamorig:` names: Hips, Spine, Spine1, Spine2, Neck, Head, Left/Right Shoulder, Arm, ForeArm, Hand,
5 fingers × 4 phalanges, UpLeg, Leg, Foot, ToeBase, plus end bones), skinned by Tripo AI, **same 5,087-vertex mesh**,
A-pose, **1.0 m tall, facing −X**, feet at y = 0, node transforms identity. All weight sums are 1; the 13 leaf end bones
(`*4`, `*Toe_End`, `HeadTop_End`) carry no weight. The home-made 19-joint rig, runtime skin-weight heuristic and the grip
morph targets are being **retired**. Stage A no longer generates bones — it audits/fixes the user's weights.
The `--from-heuristic` asset currently in `public/models/male-rigged.glb` is a stop-gap only.

## Decisions (coordinator, binding)
- **Facing:** the shipped asset faces **−Z**, baked into the file (luna's `--from-source` already does this; sol must
  produce the same). The runtime adds **no** wrapper rotation. Ignore the rig-guide's "+π/2 wrapper" alternative.
- **Current asset:** `public/models/male-rigged.glb` = validated v2 from the user's source weights (72,772 B, 4,395 verts,
  52 joints). sol's fixed-weights version will replace it through the same validator.
- **Runtime binding:** keep GLTFLoader's bind matrices / AttachedBindMode; never call `skeleton.calculateInverses()`;
  match bones by `userData.name`, fallback strip `/^mixamorig\d*[:_]?/i`; set `frustumCulled = false` (or a big sphere).
- **Bone axes:** never hard-code Euler axes; derive hinge/pole/palm/sole axes from rest geometry at load (rig-guide §2).
- **Mirror axis in Blender:** the L/R mirror is glTF Z → **Blender Y** on the source; mesh symmetry is only 0.2–6 mm, so
  use the KD-tree name-swapping mirror from rig-guide §5, not `vertex_group_mirror`.

## Goal
Ship the user's rig as an optimized GLB and drive it procedurally: pose-to-pose keyed strokes following the 12 principles
of animation (`reference/animation-principles.md`), real finger curl for the grip, spine/neck distribution, toe bend,
and arms that never stick to the torso. "Just enough for the web": no keyframe clips, no bundle bloat.

## References (every agent reads the ones relevant to them)
- `reference/video-guide.md` — measured poses/timings from the user's video (serve, dink, volley, smash, ready).
- `reference/animation-principles.md` — pose-to-pose spec, 12 principles, arm-clearance rule.
- `reference/technique-research.md` — web research on all 15 shots (being written).
- `reference/rig-guide.md` — web research on Mixamo rigs, IK → hierarchy retargeting, weight painting (being written).

## Agents and ownership (edit ONLY files you own)
| ID | Agent | Role | Owns |
|---|---|---|---|
| `sol` | Codex · GPT-6.1-Sol, xhigh, --search, MCP blender (also reviewer, see tasks/shot-loop.md) | Stage A: audit + fix weights of the user rig in Blender, normalize | `tools/rig/blender_rig.py`, `tools/rig/out/*` |
| `luna` | Pi · gpt-6-luna, medium | Stage B: finalize, compress, validate | `tools/rig/finalize.ts`, `tools/rig/validate.ts`, `tools/rig/lib/*`, `package.json`, `package-lock.json`, `public/models/male-rigged.glb` |
| `fable` (runtime + per-shot implementer; took over from `pisol`, which hit its ChatGPT usage limit 2026-10-09 ~21:00) | Claude Fable (coordinator subagent) | Stage C + tech lead: runtime retarget, keyed animation, clearance, sign-off | `src/**`, `tests/*.test.ts`, `vite.config.ts` |
| `flash` | Pi · gpt-6-luna, medium | QA + docs | `tests/pose-snapshots.mjs`, the `launch` line in `tests/*-browser.mjs`/`browser.mjs`, `.agents/qa/*`, `docs/*`, `README.md` |

`tools/rig/source/` is read-only for everyone (user's file). Need a change in a file you don't own? Write it under
**Requests** in your status file. Only `luna` runs `npm install`. Nobody deletes `public/models/male-base.glb`.

## Shared environment
- **One server only**: dev server http://localhost:5173 (started by the coordinator). Do not start or kill servers.
  The frozen baseline build is in `.agents/qa/baseline-dist/` with screenshots in `.agents/qa/before/`.
- Blender 5.2.2: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Headless:
  `--background --factory-startup --python <script> -- <args>`.
- Node 24, npm 11, TS scripts via `npx vite-node <file.ts>`. Tests `npm test` (87 at baseline), build `npm run build`.
- Playwright: use the installed Chrome (`PW_CHANNEL=chrome`), never download browsers.

## Asset contract v2 — `public/models/male-rigged.glb`
1. One skinned mesh primitive (triangles) in **app space**: height **1.8 m**, min y = 0, x-center of the bbox = 0,
   character faces **−Z**, left hand on −X, Y-up. (Source is 1.0 m facing −X → uniform scale 1.8 and a −90° turn
   about +Y; verify with joint positions: `LeftHand.x < 0`, toes at −Z.)
2. Attributes `POSITION`, `NORMAL`, `JOINTS_0`, `WEIGHTS_0` (≤ 4 influences, sums 1 ± 1e-3, no zero vertex),
   **no** `TEXCOORD_0`, uint16 indices, **no morph targets** (finger bones do the grip).
3. Skeleton: the user's Mixamo hierarchy and bone names, unchanged except that unweighted leaf end bones may be pruned
   (`*4`, `*Toe_End`, `HeadTop_End`). Names stay `mixamorig:<Bone>` in the file; the runtime matches names robustly
   (GLTFLoader may sanitize `:`), by suffix `<Bone>`. Rest pose = the user's A-pose, scaled/rotated with the mesh.
   Joint rest world positions = source positions × transform, within 1 mm.
4. Weights: the user's Tripo weights, **audited and fixed** by stage A (see `tasks/sol.md`); no bone renamed or re-parented.
5. Compression: `KHR_mesh_quantization` + `EXT_meshopt_compression`; position ≥ 14-bit, normals ≥ 8-bit, weights 8-bit;
   ≤ 120 KB. No Draco. Quantization detail (opus): the dequantization ends up in the IBMs; mesh node and ancestors are
   identity in the final file, `D = jointWorld[j]·IBM[j]` is the same uniform-scale+translation matrix for all joints,
   app-space position = `D·POSITION`. The validator checks app-space values after decoding.
6. No decimation.

`tools/rig/validate.ts` is the executable form of this contract; luna updates it to v2 and everyone runs it.

## Pipeline
```
tools/rig/source/human-rig.glb ─[A: sol, Blender]─> tools/rig/out/human-rig.fixed.glb (app space, fixed weights, pruned)
                               ─[B: luna]─────────> public/models/male-rigged.glb      (no UV, weld, quantize, meshopt, validated)
                               ─[C: opus]─────────> src/scene/humanoid.ts drives the Mixamo skeleton (IK → local quats, fingers, spine)
                                 [D: opus]          pose-to-pose keyed strokes + arm clearance (animation-principles.md)
                               ─[QA: flash]───────> .agents/qa/after.md + docs
```
To unblock C before A is done, luna also builds the asset straight from the source (`--from-source`: normalize + compress,
weights untouched).

## Status protocol
Each agent keeps `.agents/status/<id>.md` updated: `State: working | blocked | done`, files changed, verification
(commands + results), open problems, `Requests`. Update at every milestone and before stopping.
