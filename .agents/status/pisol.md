# pisol — runtime / motion

State: **working** (priority 0a first).

## Scope / decisions
- Own `src/**`, `tests/*.test.ts`, `vite.config.ts`; authorized scratch/QA/status work. Do not change `tools/rig/`, `public/models/`, packages, or the running :5173 server.
- Read v2 board/Decisions, opus handoff, sol-runtime task, animation principles, technique research C/D/E, rig guide.
- Prioritize stateless, seekable C1 motion (matched Hermite tangents) over hiding discontinuities with rendering. 24 fps will be render pacing only, not simulation speed.

## Baseline (reproduced)
- `npx vite-node .agents/scratch/jerk.ts`: paddle velocity jumps **2.50–17.16 m/s per 1/240 s**; serve 16.01 at +0.303 s, smash 17.16 at +0.354 s. Touch-shot maximum speed occurs on ready→load, not contact.
- `npm test`: **99/99** (handoff was 97; two diagnostic tests also present). Existing code already loads the v2 Mixamo GLB, no heuristic fallback.
- Root causes seen: nonzero ease-out-back derivative starts recovery from a stationary follow key; path recovery multiplied twice; readiness compressed into 45% of tiny touch-shot preparations; discrete hand socket / pole searches and reach-assist branches; stateful gait anchor swaps.

## Next
- Fix stroke/body timelines and playback transitions, extend jerk harness with actual rig joints, add 240 Hz regression coverage.
- Fixed 24 fps render clock + single-pass paddle/ball shutter ghosts; benchmark and Chrome screenshots.
- Recheck runtime arms, grip, toes and all-shot silhouettes; preserve asset binding contract.

## Requests
None.
