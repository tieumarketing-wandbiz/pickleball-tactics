# Task `luna` — Stage B v2: finalize + validate the Mixamo rig (Pi · gpt-6-luna, medium)

Read `.agents/README.md` (**v2 contract** — the 19-joint/morph contract is retired) and `.agents/reference/rig-guide.md`
if present. Your files: `tools/rig/finalize.ts`, `tools/rig/validate.ts`, `tools/rig/lib/*`, `package.json`,
`package-lock.json`, `public/models/male-rigged.glb`. Status: `.agents/status/luna.md`.

## Step 1 — validator v2
Rewrite `validate.ts` for contract v2: one skinned primitive; app-space (decoded, via `D = jointWorld·IBM`, check D is
identical across joints) height 1.8 ± 1e-3, min y 0, x-center 0, faces −Z (`LeftHand` joint x < 0, `LeftToeBase` z <
`LeftFoot` z); attributes and no UV/no morphs; ≤ 4 influences, sums, no zero vertex; Mixamo bone set present (match by
name suffix after `mixamorig`, tolerate `:`/`_`/none), no renamed or extra non-Mixamo bones, end bones optional;
hierarchy matches the source (`tools/rig/source/human-rig.glb`) parent-for-parent; joint rest world positions equal the
source positions × (scale 1.8, −90° about Y, translation) within 1 mm; meshopt present; ≤ 120 KB. `--raw` skips the
compression checks. Report PASS/FAIL per item, non-zero exit on failure. Keep the old v1 checks out (delete them).

## Step 2 — `finalize.ts --from-source` (unblocks opus now)
From `tools/rig/source/human-rig.glb`: apply the normalization (scale 1.8, rotate −90° about +Y, re-center x, feet at
0) to positions, normals, joint rest transforms and IBMs consistently (or bake with gltf-transform and recompute IBMs),
prune unweighted end bones, drop UVs + material textures, weld, reorder, quantize, meshopt. Validate. Also prove with
three's `GLTFLoader` + `MeshoptDecoder` under vite-node that the SkinnedMesh loads and, posed in bind pose, its skinned
vertex bbox matches the contract (catches IBM mistakes). Write the file, report size + vertex count + joint count.

## Step 3 — default mode (from `tools/rig/out/human-rig.fixed.glb`, made by sol)
Same pipeline minus normalization (sol already did it; verify instead). Only when `.agents/status/sol.md` says done.
