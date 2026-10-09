# Task `opus` — Stage C + tech lead (Pi · claude-opus-5-5, thinking high)

Read `.agents/README.md` first (contract, ownership, environment). Your files: `src/**`, `tests/*.test.ts`, `vite.config.ts`.
Status file: `.agents/status/opus.md`. You are the tech lead: you own the runtime, review the other stages against the
contract, and give the final sign-off.

## Step 1 — prepare (no asset needed yet)
- Read `src/scene/humanoid.ts`, `src/scene/grip.ts`, `src/scene/players.ts`, `tests/humanoid.test.ts`.
- `luna`'s validator wants the `rest`/`ends` joint tables: export them (e.g. `export const HUMANOID_REST`, `HUMANOID_ENDS`,
  `HUMANOID_JOINTS`) from `src/scene/humanoid.ts` without changing behavior. Note it in your status file.
- Review `.agents/tasks/sol.md` and `luna.md`. If the contract has a hole that would break the runtime, fix it in
  `.agents/README.md` (you may edit the contract section) and say so in your status.

## Step 2 — runtime integration (start once `luna` reports the `--from-heuristic` asset)
- `loadHumanoidGeometry()` loads `models/male-rigged.glb` via `import.meta.env.BASE_URL` (fixes the absolute `/models/...`
  path), with `MeshoptDecoder` from `three/addons/libs/meshopt_decoder.module.js` registered on the `GLTFLoader`.
- Build the geometry from the loaded `SkinnedMesh`: keep position/normal/index, remap `skinIndex` by joint **name** to the
  `names` order, keep the two morph targets (GLTFLoader gives `morphTargetsRelative = true` — make sure the `Humanoid`
  constructor's `geometry.clone()` and the material keep that working). Dequantize if needed so the existing vertex-color
  code and IK see the same values. `Humanoid` keeps creating its own identity-rotation bones at `rest[]`; do not import
  the GLB skeleton.
- The app must no longer run `prepareHumanoidGeometry` at startup. Keep the function exported (luna's `--from-heuristic`
  and the tests use it); Vite tree-shakes it from the bundle — verify with `npm run build` that the app chunk shrinks or
  at least doesn't grow.
- `tests/humanoid.test.ts`: load `public/models/male-rigged.glb` (register the meshopt decoder in Node — check it works
  under Vitest), keep all existing invariants (finite deformation, feet near ground, grip retention, support hand), drop the
  hard-coded `5087` vertex count in favor of the contract checks, and keep one test that the heuristic path still works.

## Step 3 — stroke animation pass from the video (start right after Step 1; independent of the asset)
**UPDATED by the user:** the pass must follow `.agents/reference/animation-principles.md` (pose-to-pose keys, 12
principles, kinetic-chain offsets, arcs, easing) and fix arms sticking to the body (clearance constraint). Use
`.agents/reference/technique-research.md` (web research covering all 15 shots) for the shots the video doesn't show.
Read `.agents/reference/video-guide.md` and open the key frames/sheets it lists. Then bring the procedural animation in
`src/core/stroke-motion.ts`, `src/core/player-pose.ts` and `Humanoid.pose()` in line with the measured specs, in this
priority order: **serve** (underhand pendulum, contact 0.45–0.6 m high in front of the front foot, high finish, staggered
stance, off arm holds/releases the ball then extends, weight shift + rear foot step), **ready stance** at the kitchen,
**dink** (deep squat, open face, lift from shoulder), **volley/punch/block** (compact, arm extension, punch hold, block
half), **smash** (cocked prep, off arm pointing up, down-and-across finish). Rules to respect: serve contact below the
waist with paddle head below the wrist; no foot crossing the kitchen line during volley/smash follow-through.
Shots the video doesn't show (drive, drop, lob, reset, speedup, roll, flick, atp, erne) — leave them unless a shared
change (e.g. ready stance) requires touching them; keep two-handed poses where they exist (the video simply doesn't show any).
- Keep the contact frame exact: the paddle must still be at the shot's contact point at t = 0 (existing tests check this).
- Update `tests/stroke-motion.test.ts` / `tests/player-pose.test.ts` with checks for the new specs (e.g. serve contact
  below pelvis height and paddle head below wrist; serve follow-through hand ≥ head height; dink hip drop).
- Note in `docs`-style comments in `stroke-motion.ts` that values now come from the guide video (keep it short).
- Coordinate with your own Step 2 edits in `humanoid.ts` — you own both, so do them sequentially.

## Step 4 (optional, low priority) — per-frame cost ("just enough for the web")
`Humanoid.pose()` runs for 4 players every animation frame and allocates many `Vector3`/`Quaternion` (`clone()`, `v()`).
Measure first (e.g. a Vitest bench or a timing loop over all shot types). Only if it matters, reuse scratch objects —
**outputs must be bit-for-bit or within 1e-9 of before** (add a test comparing bone transforms before/after for a set of
poses). Do not restructure the IK. Report the numbers either way.

## Step 5 — review + sign-off
When `sol` and `luna` are done: run `npm run rig:validate`, `npm test`, `npm run build`, open http://localhost:5173 and
play a rally. Compare deformation of the Blender-weighted asset against the heuristic one (shoulders, elbows, hips, knees,
grip). If the Blender weights are worse anywhere, write concrete Requests to `sol`. Final status: what shipped, sizes
(GLB, JS chunks), test counts, open risks.
