# flash — status

State: blocked (waiting for opus)

## Phase 1 — baseline
- All four browser scripts use the requested `PW_CHANNEL` Chrome option. Existing browser suites had passed with Chrome in the previous run; this iteration focused on snapshot improvements.
- Improved `tests/pose-snapshots.mjs`: deviceScaleFactor 2; side preset close-ups around the hitter and 3D/baseline contacts; fresh playback per shot phase; distinct-image assertions for backswing/contact/follow-through; six spaced rally captures with consecutive-image difference checks/restart if short rally finishes.
- Re-ran against frozen 4173, overwriting `.agents/qa/before/`. Inspected side close-ups for all shot families and 3D contact/full view. Hitter now occupies about 200 px of a ~500 px crop; full body/racket are visible. Each shot phase image is distinct (`phasesVisiblyDiffer: true`). Six rally images are distinct (`rallyConsecutiveImagesDiffer: true`); displayed UI clock is whole-second precision and default playback duration reports 00:01.
- Snapshot metrics (latest): visible-player time 2,053 ms; male-base GLB 269,968 bytes each (15 requests over reset/reload workflow); 5 s RAF mean 8.361 ms, p95 8.4 ms, max 16.6 ms.
- Baseline results and caveats updated in `.agents/qa/baseline.md`. Unit (87), build, and three browser suite results previously recorded there.

## Phase 2 — docs
- Corrected GLB asset description in `README.md` and `docs/design-system.md`.
- Added historical context for the early 58-test figure in `docs/validation-report.md`.
- Documented `test:volley` and clarified which existing test scripts honor `PREVIEW_URL` in `README.md`.
- Drafted Vietnamese `docs/rig-pipeline.md`; marked integration/build details needing confirmation as TODO.

## Open problems / Requests
- Phase 3 not run: `.agents/status/opus.md` reports work in progress, integration/animation completion not confirmed.
