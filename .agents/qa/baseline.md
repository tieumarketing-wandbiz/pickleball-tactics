# Baseline QA (Phase 1)

Run date: 2026-10-08. Frozen target: `http://localhost:4173/` (server now stopped by coordinator; to reproduce, run `npx vite preview --port 4173 --outDir .agents/qa/baseline-dist` temporarily); existing e2e scripts target the live dev server at `http://localhost:5173/`. No server was started or stopped. Playwright used installed Google Chrome via `PW_CHANNEL=chrome`; no browser download was needed.

## Snapshot / visual baseline

Command:

```sh
PW_CHANNEL=chrome PREVIEW_URL=http://localhost:4173/ node tests/pose-snapshots.mjs .agents/qa/before
```

PASS. Screenshots and `.agents/qa/before/metrics.json` were overwritten after improving crop/timing. Snapshot page uses device scale factor 2, side-camera close crops centered on the hitter, plus a 3D/baseline camera view for each shot contact. The side close-ups show the player at roughly 200 px high in a 500 px crop (rather than ~60 px in the full-court image); full body, racket and surrounding play context are visible. I inspected serve, dink, volley and smash phase images. Script compares the three image buffers for each shot and asserts that each set visibly differs; all four `phasesVisiblyDiffer` checks are true. Pose timestamps are 100/300/500 ms from fresh preview playback; they are timed samples, not exact physiological event markers.

Default-rally snapshots: six screenshots in `.agents/qa/before/rally-1.png` through `rally-6.png`. The UI rounds its play clock to whole seconds (reported duration `00:01`), so repeated same-second timestamps are expected. The script verifies consecutive screenshot buffers differ and restarts the default scenario if playback completes before all six samples; `rallyConsecutiveImagesDiffer` is true. I visually checked rally samples; court/players render and the ball/pose changes. Camera overview images `camera-top.png` and `camera-side.png` also captured.

Measured: visible-player time 2,053 ms. GLB response `male-base.glb`: 269,968 bytes per response (15 requests observed due to fresh-page reloads used to reset preview phases and short rally playback). Five-second RAF sampling: 598 intervals, mean 8.361 ms, p95 8.4 ms, max 16.6 ms. These are headless Chrome measurements, not device performance.

## Commands and results

- `npm test` — PASS, 87 tests in 10 files.
- `npm run build` — PASS. Output sizes: HTML 0.74 kB (gzip 0.48); CSS 12.76 kB (gzip 3.56); app JS 118.76 kB (gzip 41.21); Three.js JS 588.22 kB (gzip 150.04). Vite emitted its >500 kB chunk warning.
- `PW_CHANNEL=chrome npm run test:e2e` — PASS against live dev server 5173.
- `PW_CHANNEL=chrome npm run test:contact` — PASS against live dev server 5173.
- `PW_CHANNEL=chrome npm run test:volley` — PASS against live dev server 5173.

The existing browser checks passed with their stated assertions. Snapshot script uses the separate frozen baseline URL on port 4173.
