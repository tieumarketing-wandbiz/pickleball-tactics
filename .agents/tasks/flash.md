# Task `flash` — QA baseline, before/after comparison, docs (Antigravity · Gemini 3.8 Flash, medium)

Read `.agents/README.md` first (contract, ownership, environment). Your files: `tests/pose-snapshots.mjs`,
`.agents/qa/*`, `docs/*`, `README.md`. Status file: `.agents/status/flash.md`. Do not edit `src/`, `tools/`, `package.json`.

## Phase 1 — baseline (do now, before other agents change the runtime)
1. Write `tests/pose-snapshots.mjs`, a Playwright script in the style of `tests/browser.mjs` (same launch/setup, reads
   `PREVIEW_URL`, default http://localhost:5173/). It should:
   - load the app, record time from navigation to the humanoids being visible (wait for the canvas to have drawn the
     players; `tests/browser.mjs` shows how the existing scripts wait), and the GLB request size from network events;
   - capture close-up screenshots of a player at backswing / contact / follow-through for at least **serve, dink,
     volley, smash** (build those steps through the UI like the existing scripts do — pick the shot button, set a target),
     so they can be compared with the video key frames in `.agents/reference/frames/`;
   - start playback of the default rally and take screenshots of the 3D view at ~6 evenly spaced moments, plus Top and Side
     camera presets, into an output dir passed as an argument (`node tests/pose-snapshots.mjs .agents/qa/before`);
   - measure frame times during 5 s of playback with `requestAnimationFrame` inside the page and report mean, p95, max;
   - write a `metrics.json` next to the screenshots.
   Note: the WebGL canvas may only paint while the page is visible; if screenshots come out blank, force a frame
   (e.g. resize the viewport by 1 px) before capturing.
2. **Baseline URL is http://localhost:4173/** — a frozen build of the ORIGINAL code (`.agents/qa/baseline-dist`), because
   `opus` edits `src/` in parallel and the dev server on 5173 hot-reloads those edits. Run
   `PREVIEW_URL=http://localhost:4173/ node tests/pose-snapshots.mjs .agents/qa/before` (set the env var the PowerShell or
   bash way, whichever shell you have) → `.agents/qa/before/`. The existing e2e scripts hardcode 5173 — run them now anyway
   and note in baseline.md that they ran against the live dev server. Also run `npm test`, `npm run build` (record chunk sizes), and the existing
   `npm run test:e2e`, `npm run test:contact`, `npm run test:volley` (dev server already up). Write `.agents/qa/baseline.md`
   with all results. Failures that already exist at baseline must be recorded as baseline failures, not fixed.

## Phase 2 — docs (can start in parallel)
- `README.md` line ~69 and `docs/design-system.md` line ~6 claim no external 3D asset is used — wrong (the app ships
  `male-base.glb`). Fix the wording.
- `docs/validation-report.md`: the early "npm test: 58 passed" entry is stale; add a note rather than rewriting history.
- README: `test:volley` script is undocumented; only `tests/browser.mjs` honors `PREVIEW_URL` — document that.
- Draft `docs/rig-pipeline.md` (Vietnamese, like the other user-facing docs) from `.agents/README.md`: what the
  pipeline is, how to rebuild the asset (`npm run rig:build`), how to validate. Mark parts not yet implemented as TODO.

## Phase 3 — after (when `.agents/status/opus.md` says integration is done)
Rerun everything from Phase 1 into `.agents/qa/after/`, write `.agents/qa/after.md` comparing before/after: load time,
GLB bytes, JS chunk sizes, frame times, test results, and a short visual comparison of the screenshots (describe any
visible artifacts: stretched shoulders, broken hands, floating feet, z-fighting). Also compare the serve/dink/volley/smash
close-ups against the matching video frames listed in `.agents/reference/video-guide.md` and list concrete mismatches
(e.g. "serve contact still above waist", "off arm not raised on smash"). Finalize `docs/rig-pipeline.md`.
If you are started before opus is done, finish Phases 1–2, set `State: blocked (waiting for opus)` and stop.
