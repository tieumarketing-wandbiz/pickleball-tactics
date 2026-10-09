State: done (v2 --from-source build validated; Step 3 not applicable because Sol status is absent)

## Opus handoff — v2 asset ready
`public/models/male-rigged.glb` is now the validated Mixamo asset: **72,772 bytes, 4,395 vertices, 52 joints**. The 13 unweighted terminal bones were pruned and `JOINTS_0` remapped. No morph targets. It is meshopt-compressed and passes v2 validation. Load in Three with:
```ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync("/models/male-rigged.glb");
```
Important: for bind-pose checks, update world matrices and call `skinnedMesh.skeleton.update()` before sampling `getVertexPosition()`; raw quantized int16 position attributes are normalized values (roughly ±1), not app-space vertices. Bind-pose skinned bbox verified as `[-0.7143, 0.00002, -0.1469]..[0.7143, 1.8000, 0.1469]`.

Files: `tools/rig/finalize.ts`, `tools/rig/validate.ts`, `tools/rig/lib/check-runtime.ts`, `tools/rig/lib/check-v2.ts`, `tools/rig/lib/inspect-source.ts`, `package.json`, `public/models/male-rigged.glb`.

Builder uses the coordinator N transform, recomputes bone local TRS/IBMs, drops UV/materials, prunes 13 unweighted end joints with JOINTS remapping, welds/reorders/quantizes at 16-bit positions/8-bit normals and weights, meshopt-compresses. It writes to a candidate GLB, runs `validate.ts`, and only promotes after validation passes.

Validator checks size, meshopt, one skinned primitive, required attributes, no UV/morphs, uint16 triangle indices, weights, retained Mixamo joint set/hierarchy, transformed rest positions, hand/toe orientation, skinned bind bbox, and 200 sampled skinned vertices against normalized source positions within 1 mm (nearest-source mapping accommodates weld/reorder).

Verification:
- `npx vite-node tools/rig/finalize.ts --from-source` — PASS; candidate validated then promoted.
- `npm run rig:validate` — PASS all v2 checks (72,772 bytes).
- `npx vite-node tools/rig/lib/check-runtime.ts` — PASS; Three.js MeshoptDecoder skinned bbox matches height 1.8/min y 0/x-center 0; 52 bones, 4,395 vertices.

`.agents/status/sol.md` was absent when checked; no Step 3 run. The coordinator's earlier warning was correct about the old checker; validator now uses actual skinned positions after skeleton update rather than raw quantized attributes.