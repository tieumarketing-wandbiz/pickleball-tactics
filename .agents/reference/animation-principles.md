# Animation spec — pose-to-pose with the 12 principles (coordinator → opus)

User feedback (2026-10-08): the motion must be **keyed pose-to-pose using the 12 principles of animation**, not a
continuous every-frame curve ("đừng key 24 frame liên tục"), and **arms stick to the body** ("tay bị dính") in many poses.
Read together with `video-guide.md` (measured poses) and `technique-research.md` (web research, all 15 shots — arriving
shortly; if it's not there yet, start with the architecture and the five shots the video covers).

## 1. Architecture: key poses + breakdowns, not per-frame formulas
Replace "profile → continuous function of t" with an authored **key-pose timeline per shot** (data, in
`src/core/stroke-motion.ts` or a new `src/core/stroke-keys.ts`), evaluated by an interpolator. Keep the public shape that
`player-pose.ts` / `Humanoid.pose()` consume so the rest of the app doesn't change.

Per shot, keys at times relative to contact (t = 0, negative before):
| Key | Purpose |
|---|---|
| `ready` | athletic ready (shared base, see §3) |
| `anticipation` | small counter-move before the backswing (weight back, knee dip, unit turn starts) — big shots only: serve, drive, lob, smash, speedup, erne |
| `load` | backswing extreme (the "drawing" that sells the shot) |
| `breakdown` | forward-swing passing position — defines the **arc**, hips already open, hand lagging |
| `contact` | exact contact (paddle at the shot's contact point — existing invariant, must stay exact) |
| `follow` | follow-through extreme |
| `settle` | small overshoot back toward ready (5–10 %), then ready |

Each key stores body-frame targets: pelvis offset + yaw, chest yaw/pitch/roll, squat, stance width/stagger, hitting-hand
position, paddle orientation (face open/closed, head above/below wrist), off-hand target, head track weight.
Author numbers from `video-guide.md` / `technique-research.md`; ~10–15 % **exaggeration** over measured values for
readability at tactics-camera distance (one global constant).

## 2. The principles, as implementation rules
1. **Timing** — key times in seconds per shot (from the research table). Fast shots (punch, block, flick, speedup) have
   2–3 frames (at 30 fps) from load to contact; slow ones (serve, lob, drop) 6–10.
2. **Slow in / slow out (spacing)** — ease *into* `load` and out of it (ease-in-out), **accelerate into contact**
   (ease-in, e.g. cubic), fastest at contact, ease-out into `follow`, then a back/overshoot ease into `settle`.
   No linear segments. Velocity must be continuous through contact (existing test).
3. **Anticipation** — the `anticipation` key: opposite-direction weight shift / dip ~0.08–0.15 s before the backswing.
4. **Follow-through & overlapping action** — kinetic chain with per-part **phase offsets** on the forward swing:
   pelvis leads, chest +0.03–0.05 s, upper arm +0.06, forearm +0.08, hand/paddle head +0.10 (scale by shot duration);
   on the takeback the order reverses (hands/paddle lead the unit turn, hips follow). Implement as each part sampling the
   timeline at `t − offset[part]`, with the offsets **blended to 0 inside ±0.03 s of contact** so the paddle is still
   exactly at the contact point at t = 0. Paddle head drags behind the wrist into contact, then overtakes it.
5. **Arcs** — interpolate the hitting-hand path through `load → breakdown → contact → follow` with a centripetal
   Catmull-Rom (or quadratic Bézier with an arc control point), never straight lerps. Orientation: slerp with the same easing.
6. **Secondary action** — off arm counterbalances (opposite to the hitting arm's rotation; points at the ball on smash;
   holds/releases the ball on serve); head tracks the ball; small shoulder shrug on overheads.
7. **Squash & stretch (realistic, subtle)** — spine compression (squat + chest pitch) at `load`, extension at contact for
   serve/smash/drive; ≤ 3–5 cm, no volume change.
8. **Exaggeration** — the global factor above; never past what the rules allow (serve contact stays below the waist,
   paddle head below wrist).
9. **Staging** — silhouettes readable from the default 3D and Top cameras: the paddle and hitting arm must separate from
   the torso outline at `load`, `contact`, `follow`.
10. **Straight-ahead vs pose-to-pose** — pose-to-pose only; procedural layers on top (IK, foot locking, gait) stay.
11. **Solid drawing / weight** — no twinning: staggered feet, asymmetric arms, weight clearly on one leg at `load` and
    shifted at contact; pelvis height follows the weight shift.
12. **Appeal** — clean, confident lines; no jitter, no popping between steps (blend from the previous shot's `settle`
    into the next shot's `ready`/`anticipation`).

## 3. Fix "arms stuck to the body" (high priority)
- Ready pose: elbows **0.15–0.25 m out from the ribs**, hands 0.25–0.35 m in front of the sternum, paddle head up
  45–70° (video: elbows ~90°, off hand near the paddle throat).
- Add a **clearance constraint after IK**: model the torso as capsules (chest ~0.17 m radius, waist ~0.15 m, along
  pelvis→chest→neck) and require elbow, wrist and paddle-hand positions to stay ≥ capsule + 0.05 m away; if violated,
  rotate the elbow bend plane outward (along the body-right axis × sign) and re-solve, and push the hand target outward
  along the capsule normal. Same for the off arm and for the paddle blade vs the torso.
- Test: for every shot type × sampled times (−0.5…+0.8 s), minimum distance from elbow/wrist/paddle to the torso capsules
  ≥ the threshold, for both teams and both handedness.
- Mesh side: `sol` checks armpit/shoulder deformation with arms away from the body; report anything that still looks
  glued after the constraint (it can also be skin weights).

## 4. Deliverable & checks
- Keys + interpolator, all 15 shots migrated (the 5 video shots first, the other 10 from the research file).
- Existing invariants stay green (contact exactness, velocity continuity, finite poses, feet on ground, grip retention).
- New tests: easing monotonic per segment, chain offsets → hand lags hips on forward swing, arcs (hand path not
  collinear), clearance, serve rules (contact below pelvis, head below wrist, high finish).
- Short comments only where a number comes from a source (cite `video-guide.md` / research file section).
