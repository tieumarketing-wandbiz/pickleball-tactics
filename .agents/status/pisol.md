# pisol — STEP 0 in progress

State: **STEP 0 NOT DONE — older worker halted to avoid concurrent writes**. No commits, no server or asset changes.

## Concurrent-worker handoff (2026-10-09)
- Detected two active implementers using the same `rig-pisol2` session ID: older PID **25424** (this run) and newer PID **22180**. The newer worker received the coordinator's urgent correction about realistic timing and invariant bone lengths, while this older worker was still testing the obsolete ≤0.3 m/s-per-240-Hz-frame requirement.
- The newer worker replaced `src/scene/humanoid.ts` with a rotation-only solver. **I have stopped source/test edits; do not restore the old filtered/stretched solver or inflate timing to satisfy the old acceleration cap.** No processes were killed.
- `.agents/qa/pisol/body-gate-filtered3.txt` through `body-gate-filtered8.txt` describe the now-replaced solver, **not the live implementation**. Latest live `npx tsc --noEmit` passed (`.agents/qa/pisol/tsc-live.txt`).
- The body gate still needs the corrected continuity/physiological checks, invariant bone lengths, and actual skeleton/foot sampling through a three-step rally; its existing rally test covers roots only. No shot-review fixes have begun.
- The older worker's unreferenced experimental `src/scene/pose-support.ts` was removed; it would have reintroduced forbidden spine translations. The newer solver and external rig/animation work were preserved.

## Historical verification — before the coordinator correction (not acceptance)
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

## Delivered infrastructure; verification still pending
- `tests/body-gate.test.ts` exists (32 tests); do not mistake adding it for a green acceptance result.
- `src/core/render-clock.ts` implements 24 fps pacing and real elapsed playback time, exact event-time pause/resume, and immediate interactive rendering.
- `src/scene/shutter-ghosts.ts` implements reusable single-pass paddle/ball ghosts and a paddle ribbon over a 1/48 s shutter, without ghost shadows. `tests/render-clock.test.ts`: 4 tests passed before the newer solver rewrite.
- Pre-rewrite Chrome measurement: 25 renders / 1.0416 s; mean CPU **2.796 ms**, GPU **1.127 ms**, **108/118 calls**, **41,440/41,456 triangles**, **93 geometries / 22 textures**, no page errors (`.agents/qa/pisol/perf-after-clock.json`). Re-benchmark the final corrected solver; these are not final acceptance numbers.
- Remaining: corrected body gate, full green suite, timing/bone-length visual verification, actual rally handoffs/foot locking, final browser pacing/pause/blur checks and build.

## Baseline cost
Chrome 1440×1000: 115 renders/s, mean CPU **3.25 ms**, GPU **2.12 ms**, **108 calls / 41,440 triangles** per render (`.agents/qa/pisol/perf-baseline.json`).

## Requests
Keep only the newer corrected implementer writing `src/**` and `tests/**`. The newer worker must mark **STEP 0 DONE** only after corrected gates/full-suite/visual verification, then check `01-ready-footwork/review.md`. This older run has stopped to prevent collisions.
