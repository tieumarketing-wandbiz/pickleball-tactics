# pisol — STEP 0 in progress

State: **working**. Implementer under `tasks/shot-loop.md`; no commits, no server or asset changes.

## Current verification
- Resumed `54fab32`: baseline **7 failures / 100 tests**, reproduced. Five failures are obsolete hard-coded timeline/hold assumptions; two are real rig issues (floating feet, wrist limits/support grip).
- Core paths now have matched Hermite tangents and one recovery curve. All 15 paddle peaks are within **0.0021 s** of contact in the standard 240 Hz audit; original jumps were 2.5–17.16 m/s/frame.
- Actual rig audit is being tightened (not just `playerPose`): continuous pole/IK, smooth wrist saturation, foot reach reserve. Latest full per-shot measurements: `.agents/qa/pisol/jerk-resume5.txt`. Gate is **not green yet**; do not start shot review fixes.
- Retarget already uses v2 Mixamo bones and loader bind matrices. Old discrete clearance/socket search is confined to authored key drawings, not selected anew on every playback frame.

## Reviewer render URL (implemented)
`http://localhost:5173/src/debug/pose-lab.html?type=serve&t=0&view=front`
- `type=idle` for ready; any of the 15 shot IDs otherwise.
- `t` is seconds relative to contact; `view=front|side|top`.
- Defaults are A1, right-handed. Optional `w=800&h=900`, `x`, `y`, `z` change canvas/contact parameters.
- Wait for `document.title === 'ready'` or `canvas[data-ready="true"]` before screenshot. A single time/view draws one deterministic panel, no running animation.

## Pending STEP 0
- Consolidated `tests/body-gate.test.ts`, including true marker-space volume checks and rally boundaries.
- Green legacy suite; explicit legs → pelvis → spine → clavicles → arms/clearance → hands/fingers → head order.
- 24 fps playback clock (real-time simulation; immediate interactive renders) + 180° paddle/ball shutter ghosts, browser timing/GPU verification.

## Baseline cost
Chrome 1440×1000: 115 renders/s, mean CPU **3.25 ms**, GPU **2.12 ms**, **108 calls / 41,440 triangles** per render (`.agents/qa/pisol/perf-baseline.json`).

## Requests
None. Will mark **STEP 0 DONE** only when the actual body gate and full suite pass, then read `01-ready-footwork/review.md` (currently absent).
