# Resume notes (paused by the user, 2026-10-09 ~00:15)

All agents stopped. Dev server http://localhost:5173 still running (coordinator's preview).

## Where each line of work stands
- **pisol** (Pi · openai/gpt-6.1-sol · thinking max, session `rig-pisol2`): mid-refactor of motion smoothness (0a),
  then 24 fps + motion blur (0b), legs + body regression gate (B/C), then `tasks/sol-runtime.md`.
  Code is MID-EDIT: `npm test` had 7 failures from its in-progress work when stopped. Resume the same session:
  `pi -p --model openai/gpt-6.1-sol --thinking max --session-id rig-pisol2 "Resume: ..."`.
  Last full prompt: `.agents/logs` (see the coordinator transcript) — legs/regression-gate instructions were sent.
- **sol** (Codex · gpt-6.1-sol · reasoning max, session `01a11c30-88b9-7fe1-8c24-e230e2e88862`): Blender weight audit
  round 3. Posing works now; armpit cleanup (370 verts) + KD-tree mirror done (L/R asymmetry 0.030 → ~0).
  Still broken in renders: shoulder/chest collapse on smash, legs not posed in lunge, legs overlapping + hand in chest
  in dink. Next queued for sol: `tasks/sol-blender-anim.md` (forehand drive keyed in Blender → web viewer).
  Resume: `codex exec resume 01a11c30-88b9-7fe1-8c24-e230e2e88862 -m gpt-6.1-sol -c model_reasoning_effort=max -c sandbox_mode=workspace-write --skip-git-repo-check "Resume: ..."`.
- **luna**: done (v2 asset validated, 72,772 B, 52 joints). Re-run `npx vite-node tools/rig/finalize.ts` (default mode)
  once sol's `human-rig.fixed.glb` is final.
- **flash** (QA): baseline in `.agents/qa/before/`; phase 3 (after-comparison) pending.
- opus / sonnet: stopped by the user (budget). Do not restart unless asked.

## User preferences learned this session
- Only one Claude-API agent at a time (free $100 API budget); prefers Sol 6.1 (Codex/Pi) for rig work.
- One server only. Playback at 24 fps with motion blur. Pose-to-pose keyed motion (12 principles), not per-frame.
- Main complaints so far: arms glued to the torso / broken wrists, jerky/stuttering motion, legs look odd,
  fixes in one area breaking another (→ regression gate).
