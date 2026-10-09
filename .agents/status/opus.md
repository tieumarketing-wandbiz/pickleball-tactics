# opus — status

## Round 2 progress log (newest first)
- 23:35 **v2 runtime live on :5173** (only `male-rigged.glb` requested; heuristic fallback removed). `npm test` 97/97.
  New `src/scene/rig.ts` (rig-guide math), `src/scene/humanoid.ts` rewritten for the Mixamo skeleton, `grip.ts` deleted.
  Before screenshots: `.agents/scratch/opus/r2/before-*.png`. Visual pass on all shots in progress.

---
# Round 1 (kept for history; superseded where round 2 says so)

State: **working / paused for this turn.**
- Step 1: **done.**
- Step 2 (v1 19-joint asset): **done**, then **superseded by contract v2** (Mixamo rig). Runtime now has a safe fallback.
  v2 retarget (drive the Mixamo skeleton) **not started — waiting for luna to report a validated v2 asset.**
- Step 3: **substantially done for the 5 video shots + ready + arm clearance**; still to do: author the 10 non-video
  shots from `reference/technique-research.md` (arrived after I started; not yet read), see "Next".
- Steps 4–5: not started.

Verification at stop: `npx tsc --noEmit` clean · `npm test` **95 passed, 1 skipped** (skipped = v1-asset contract test,
auto-skips because `public/models/male-rigged.glb` is currently luna's v2 candidate) · `npm run build` PASS ·
headless msedge on :5173: app loads, 4 players render, no errors except a pre-existing favicon 404.

## Decisions (made without anyone to ask)
- **v1 → fallback.** luna's unvalidated v2 candidate overwrote `public/models/male-rigged.glb` (22:48) and has
  `mixamorig*` bones. `loadHumanoidGeometry()` now tries the rigged GLB (v1 contract) and, if unusable, warns and rigs
  `male-base.glb` at load time (old path). Keeps the live app working during the migration. Cost: `prepareHumanoidGeometry`
  is back in the bundle (+~5 kB) until the v2 runtime lands; remove the fallback then.
- `DEFAULT_HEIGHT.serve` 0.8 → **0.6** and initial scenario serve contact y 0.6 (video 0.45–0.6). Not lower: with this
  mesh's arm (shoulder→wrist 0.507 m, shoulders 13 cm behind the spine) a lower contact can't be reached with the paddle
  head down. `DEFAULT_HEIGHT.smash` 2.3 → **2.2** (video: 0.3–0.4 m above the head; 2.3 was out of reach).
- Ready paddle elbows end up ~110–125°, not 90°: hands 0.25–0.35 m in front of the sternum and 90° elbows are mutually
  exclusive with this rig's short arms; I kept the hands-in-front placement. Re-tune once the Mixamo rig (different
  proportions) is driven.
- Unit turn: one-handed backhands get +0.4 rad chest turn (+0.2 hips) so the hitting arm doesn't cross the chest.

## What changed (files)
- `src/scene/humanoid.ts` — exports `HUMANOID_REST/ENDS/JOINTS`; `loadHumanoidGeometry()` (BASE_URL path, meshopt
  decoder lazy chunk fetched in parallel, fallback); `riggedHumanoidGeometry()` (v1: applies bind matrix D incl.
  dequantization, remaps joints by name, relative grip morphs); `pose()`: feet from `pose.feet`, new off-arm goals
  (ready → paddle throat, serve hold→release→extend, dink balance arm, volley at throat, smash points at ball → chest),
  **arm clearance constraint** (torso capsules pelvis→chest→neck r 0.13/0.15 + 5 cm; elbow bend-plane search, wrist
  push-out loop, hitting/support hand locked within ±0.06 s of contact), exported `torsoPush`, `ARM_CLEARANCE`,
  `Humanoid.torsoCapsules`.
- `src/core/stroke-motion.ts` — **pose-to-pose engine**: keys start → [anticipation, big shots] → load → breakdown
  (arc) → contact → follow [→ hold]; cubic Hermite with eased extremes, breakdown/contact passing keys, contact tangent
  1.8× incoming chord (fastest at contact; checked numerically for 8 shots); kinetic-chain lags per part (pelvis,
  chest, arm, paddle face: hands lead the takeback, hips lead the forward swing, lags fade to 0 exactly at contact and
  mirror after → whip + overtake); settle with ~6 % overshoot; `EXAGGERATION = 1.1`; load compression / contact
  extension. Video-tuned profiles for serve/dink/volley/punch/block/smash (+ new optional fields). The other 9 shots run
  through the same engine with keys derived from their old profiles.
- `src/core/player-pose.ts` — shared `readyStance()` (kitchen vs baseline) everyone blends from/to; body step-back so
  contact is in front (serve also sideways + rear-foot recovery step); `pose.feet`; kitchen-line foot clamp for
  volleys/overheads (`TOE_REACH`); paddle head down (serve/dink), head up for volleys, serve finish over the head,
  overhead cock + side-on stance that unwinds; serve shoulder dip & weight press; ready elbow flare.
- `src/core/constants.ts`, `src/core/scenario.ts` — default contact heights above. `src/vite-env.d.ts` — vite types.
- Dev only (not in build): `src/debug/pose-lab.html|ts` — `/src/debug/pose-lab.html?type=serve&y=0.6&x=0&z=0`
  renders a figure at several times from 3 views + metrics. Screenshot helper `.agents/scratch/opus/shot.mjs`.
- Tests: `tests/humanoid.test.ts` (asset contract test v1-only, heuristic path, **clearance for all shots × times ×
  teams × hands**, **serve rules** (contact below pelvis, head below wrist, finish hand ≥ 1.6 m), **dink** pelvis drop
  ≥ 20 cm + head below wrist), `tests/stroke-motion.test.ts` (monotonic acceleration into contact, hips lead paddle,
  arcs not collinear, settle overshoot 3–10 %, punch hold), `tests/player-pose.test.ts` (kitchen rule, shared ready).

## Sizes
GLB: base 269,968 B; v1 heuristic asset was 79,332 B (now replaced by luna's v2 candidate 73,060 B, unvalidated).
JS: app chunk 118.76 kB baseline → 126.99 kB now (gzip 41.21 → 44.76; includes the fallback rig + animation engine);
`meshopt_decoder` lazy chunk 22.10 kB (gzip 5.96); three chunk unchanged 588.23 kB.

## Open problems
- Near contact (±0.06 s) the locked hitting/support hand can be up to ~2.5 cm inside the torso margin on some
  two-handed backhands (test allows it; elsewhere ≥ 2 cm clearance is enforced).
- Serve contact with the paddle at the ball is within ~5 cm (paddle face covers it) at y 0.6; lower contacts miss more.
- The app's ball sits at the contact point during the serve preparation, so the off hand can't literally hold it.
- Head tracking, staging check from the default/Top camera, and squash/stretch only lightly done.

## Next (my next turn)
1. Read `reference/technique-research.md`, `rig-guide.md`, `motion-sources.md`; author keys for drive, drop, lob,
   reset, speedup, roll, flick, ATP, Erne (currently derived from old profiles).
2. When luna reports a **validated** v2 asset: v2 runtime — load the Mixamo SkinnedMesh as-is, map bones by suffix,
   convert the IK targets (pelvis/chest/head, arms, legs) into local quaternions on the Mixamo hierarchy, distribute
   spine twist over Spine/Spine1/Spine2, finger curl for the grip (replaces morphs), toe bend; port the clearance
   constraint; drop the v1 loader + fallback; update tests (contract v2).
3. Steps 4–5.

## Requests
- **luna:** please write build candidates to a temp path and only replace `public/models/male-rigged.glb` after
  `rig:validate` passes (you noted this too). Tell me in your status when a validated v2 file is in place.
  The runtime check you need for v2: in bind pose, `bone.matrixWorld · boneInverse · mesh.bindMatrix` must be the same
  matrix for every joint (that's what the dequantization in the IBMs implies); compute skinned vertices with that and
  compare the bbox to 1.8 m. Three's `computeBoundingBox()` is not a valid check (ignores skinning; adds relative
  morph ranges).
- **flash:** after-QA should wait for the v2 runtime; for now you can screenshot the new animation (serve/dink/volley/
  smash) on :5173 — it runs on the fallback rig.
