# Mocap + IK pipeline (decided by the user, 2026-10-09)

Why: hand-coding joint angles per shot is slow and whack-a-mole (fix legs → arms break). Sports games use captured base
motion + an IK correction layer for exact contact. The user chose **Mixamo (locomotion/idle) + GVHMR local (video →
mocap for strokes)**. One character (A1) is enough; the code is shared by all 4 players.

## Stages
| # | Who | What | Output |
|---|---|---|---|
| M1 | **user** | DONE: 14 Mixamo clips in `assets-src/mixamo/` (map: `clips-map.json`). No SMPL registration — the user chose **MediaPipe Pose** (registration-free, Apache-2.0) instead of GVHMR (demo, non-commercial). | `assets-src/mixamo/*.fbx` |
| M2 | coordinator (+ helper agent) | MediaPipe Pose Landmarker (heavy) at `D:\AI\Tools\mocap`: per-frame 33 world landmarks for each stroke clip cut from `guide-pickleball.mp4` (and any clips the user films: 3–5 s, static camera, full body visible, one stroke each), plus overlay videos and `RETARGET_NOTES.md`. | `D:\AI\Tools\mocap\out\<clip>.landmarks.json` |
| M3 | **sol** (Codex, Blender via MCP + CLI) | Retarget MediaPipe landmarks → user's Mixamo rig (IK/aim constraints per limb from landmark positions) (A-pose rest; retarget by world rotations, not raw local keys) and Mixamo FBX → user's rig. Clean up: foot locking, root in place, trim each stroke to ready → … → ready, mark the **contact frame**. Fix obvious mocap noise (jitter filter), never change the timing of contact. Export one animation GLB (resample, quantize, meshopt) with clip names + metadata in `extras` (`contactFrame`, `fps`, `hand`, `shotType`, `loop`). | `public/anim/clips.glb` + `tools/rig/anim/clips.json` + contact-sheet renders for review |
| M4 | **pisol** (Pi, runtime) | AnimationMixer per player: lower-body locomotion layer (Mixamo, speed-matched to movement), full-body stroke clips **time-warped** so the clip's contact frame lands exactly on the ball contact time, then an **IK correction layer** spread smoothly over the swing (not snapped at contact) so the paddle hits the exact contact point; kitchen-line constraint; inertialized transitions; 24 fps + motion blur; keep the body gate green (relax only rules the mocap legitimately violates, and say which). Procedural keys stay as the fallback for shots without a clip. | runtime in `src/` |
| QA | sol (review) | Per shot: compare app renders against the video frames and the mocap source; PASS / list of issues. | `.agents/shots/NN-*/verdict.md` |

## Shot → source map (first pass)
| Shot | Source |
|---|---|
| ready / split step / shuffle / backpedal / walk | Mixamo |
| serve | video: `serve_drop`, `serve_game` |
| dink | video: `dink_lunge`, `dink_deep` |
| volley / punch / block | video: `volley_kitchen`, `punch_hold` |
| smash | video: `overhead_a`, `overhead_b` |
| reset / drop | video: `transition_low` (weak) → better: user films |
| drive, lob, speedup, roll, flick, atp, erne | **user films** (3–5 s each, static camera) — else procedural fallback |
