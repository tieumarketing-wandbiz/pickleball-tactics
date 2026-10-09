# Task `sol` — Stage C: runtime rig + arm fix (Codex · GPT-6.1-Sol, reasoning max)

The user moved ALL rig work to you (opus and sonnet are stopped). You now also own `src/**`, `tests/*.test.ts`,
`vite.config.ts`. Read `.agents/README.md` (v2 + **Decisions**), `.agents/status/opus.md` (what opus built), then the
in-progress v2 code: `src/scene/rig.ts` (new, by opus), `src/scene/humanoid.ts`, `src/scene/players.ts`.
State at hand-over (23:36): `npm test` 97/97, `tsc --noEmit` clean, app works on http://localhost:5173 using the v1
fallback rig. Build on it; don't restart from scratch unless it is clearly wrong.

References: `.agents/reference/rig-guide.md` (§2–8, measured on this asset), `animation-principles.md`,
`technique-research.md` (§E tables), `video-guide.md` + `frames/`.

## Priorities
1. **Drive the user's Mixamo asset** `public/models/male-rigged.glb` (validated, 52 joints, faces −Z; replace it with
   your fixed-weights build only through luna's validator: `npx vite-node tools/rig/finalize.ts` default mode reads
   `tools/rig/out/human-rig.fixed.glb`). Cached rest frames, `local = inverse(parentWorld)·world` top-down, analytic
   two-bone IK with explicit pole vectors, spine split 0.15/0.35/0.50, neck/head, swing-twist forearm split ~50 %,
   finger-curl grip with the paddle on a hand socket, toe bend, foot lock. Keep loader bind matrices; never
   `calculateInverses()`; match bones by `userData.name`. Then remove the v1/heuristic fallback from the app path.
2. **Fix the arms** (the user's main complaint; their screenshots of the live app): elbows pinned to the ribs, forearms
   crossing in front of the chest, paddle held vertical in front of the face, hands crossing the midline, an off arm folded
   at an acute elbow with a sharply bent wrist, arm mesh overlapping the torso. Required:
   - ready: paddle 0.25–0.35 m in front of the sternum at chest height, head up 45–70°, face to the net; elbows
     0.12–0.20 m out from the ribs and slightly forward; forearms not crossing the midline (except deliberate backhands);
     off hand near but not across the paddle throat;
   - elbow pole = down + outward + slightly back, never into the ribs;
   - **limb-volume** clearance: segment-to-capsule distance (upper arm r≈0.05, forearm r≈0.04 vs torso capsules)
     ≥ sum of radii + 0.03 m, sampled along the segments;
   - joint limits: elbow 25–160°, wrist flex/ext ≤ 60°, deviation ≤ 30°;
   - re-check opus's serve 0.6 m / smash 2.2 m / ready-elbow compromises against the Mixamo arm length.
3. Then the 9 shots the video doesn't show → key poses from `technique-research.md` §E, pose-to-pose per
   `animation-principles.md`.

## Verify visually (mandatory)
Render every shot at ready / load / contact / follow from front, side and top (opus's `src/debug/pose-lab.html` and
`.agents/scratch/opus/shot.mjs`; Playwright with `PW_CHANNEL=chrome`, never download browsers). Open the images and look
at arms, wrists, hands. Compare ready/serve/dink/volley/smash with `.agents/reference/frames/*.jpg`. Save to
`.agents/qa/sol-runtime/` and list before/after paths in your status. Add tests for limb-volume clearance, midline
crossing and joint limits. Keep `npm test` green and :5173 working at every step (the user's live view; never start or
kill servers).
