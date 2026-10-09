# Theatre.js pose demo (dev only)

A standalone page for judging whether [Theatre.js](https://www.theatrejs.com) (browser keyframe
timeline + curve editor) is a good way to author pickleball player animation. It drives the real
rig (`public/models/male-rigged.glb`) with ~10 high-level controls through a small IK driver
written for this page. Nothing here is imported by the app, and the production build does not
include it. The root `index.html` is still the only build entry.

**Open:** <http://localhost:5173/src/debug/theatre/index.html> (needs the normal `npm run dev` server).

Query options: `?motion=dink|punch-volley|split-step-shuffle`, `&t=0.83` (pause at a time),
`&cam=34|front|side|back`, `&play=0`, `&studio=0` (core only, no editor; this is what a shipped
runtime would load).

| File | What it is |
|---|---|
| `main.ts`, `index.html` | Scene, Theatre project and sheets, playback panel, QA hook (`window.__theatreDemo`) |
| `controls.ts` | The Theatre props (units, ranges, defaults = the kitchen ready pose) |
| `rig.ts` | Self-contained rig driver: two-bone IK with poles, spine split 0.15/0.35/0.50, forearm twist split, foot sole frames with heel lift about the ball, finger grip, paddle socket |
| `paddle.ts` | Procedural paddle. Red = forehand (palm-side) face, blue = backhand face |
| `state.json` | Theatre project state: 3 sheets, 62 tracks, 427 keys. Loaded on start |
| `author-state.mjs` | Script that generated the first `state.json` from pose tables (`node src/debug/theatre/author-state.mjs`). **Running it overwrites any studio edits saved into `state.json`.** |
| `qa-shots.mjs` | Playwright QA: `PW_CHANNEL=chrome node src/debug/theatre/qa-shots.mjs`. Writes contact sheets and metrics to `.agents/qa/theatre-demo/` |

## Controls (one Theatre object each, in every sheet)

All values are in metres or degrees. The body frame is x = right, y = up, z = forward (toward the
net), with the origin on the ground between the feet. Studio labels are short because the panel
truncates long ones.

| Object | Props |
|---|---|
| Body / Pelvis | `offset` x/y/z (from the rest hips), `yaw` (+ turns right), `pitch` (+ tips forward) |
| Body / Chest | `yaw`, `pitch`, `roll` relative to the pelvis, split over Spine/Spine1/Spine2 |
| Body / Head | `yaw`, `pitch` (+ looks down): a world look direction, capped at 75° from the chest |
| Arms / Paddle hand R | `grip` x/y/z = grip centre on the handle (the IK target). `paddle`: `aim°` = face yaw, `open°` = face tilt to the sky, `head°` = handle angle in the face plane (0 = head to the right, 90 = up). `elbow out°` = pole swivel |
| Arms / Hand L | `wrist` x/y/z (IK target), `elbow out°` |
| Legs / Foot L, Foot R | `x`, `z` = ankle on the ground, `toe-out°`, `heel lift°` (pivots about the ball, so the ball stays planted), `lift m` |

The panel shows live QA readouts:
- elbow-to-rib gap (red below 0.08 m);
- IK reach shortfall;
- paddle-wrist swing and twist, so you can see whether a paddle orientation is anatomically possible.

## Editing in Theatre studio

1. Pick a motion in the panel. This selects that sheet's `Paddle hand R`, so the sequence editor
   at the bottom shows that sheet. Any object in the outline (left) works as well.
2. Scrub by dragging the playhead. Space plays and pauses inside the studio. The panel buttons
   control playback separately:
   - loop;
   - 0.25×, 0.5× and 1× speed;
   - a **24 fps** option that ticks the sequence on its own 24 Hz driver, so you see stepped,
     film-like spacing.
3. Change a value in the details panel (right) or drag it. On a prop that already has keys, this
   creates or updates the key at the playhead. The ◆ between the ‹ › arrows adds or removes a key.
   The keyframe grid snaps to 24 fps.
4. Curves:
   - Click the line between two keys to open the easing popover (presets plus a bézier editor).
   - The small curve icon next to a prop opens it in the graph editor.
   - Drag keys left or right to change timing or to offset the kinetic chain (hips lead, hand lags).
5. `alt + \` hides or shows the whole studio UI.

Edits are kept in the browser (localStorage key `pickleball-theatre-demo`) until you export them.

## Export / saving back to `state.json`

Click **Export state JSON** in the panel, which calls `studio.createContentOfSaveFile("Pickleball")`.
Theatre's own way also works: click *Pickleball* at the top of the outline, then *Export Pickleball
to JSON*. Either way you get a JSON download. Overwrite `src/debug/theatre/state.json` with it and
reload.

If the browser state and the file disagree, Theatre shows a notice asking which one to keep. To
start clean, run this in the console:

```js
__theatreDemo.theatre.studio.__experimental.__experimental_clearPersistentStorage("pickleball-theatre-demo")
```

## What was verified

Checked with `qa-shots.mjs`. Output is in `.agents/qa/theatre-demo/`; `qa-log.txt` has the metrics.

- Studio loads. Outline, details, sequence editor, easing popover and graph editor all work
  (`*-studio.png`, `studio-easing-popover.png`, `studio-graph-editor.png`).
- The console is clean.
- Playback works: the playhead moved 0.70 s in 0.7 s, 0.25× moved 0.20 s in 0.8 s, and 24 fps
  mode produced 25 distinct positions per second. The skeleton toggle and export round-trip also
  work: an edit at a key updates that key, survives a reload, and appears in the export.
- All 3 motions:
  - IK reaches its targets (shortfall at most 5 mm);
  - feet show 0 slide while planted;
  - elbows stay at least 0.11 m off the ribs (0.14–0.24 m in ready and at contact);
  - paddle-wrist swing is at most 47°;
  - forearm twist peaks at 108° on the dink (supination for the open face), slightly above the
    rig's 100° split clamp.

## Findings worth knowing (problems hit while building this)

- **Paddle orientation has to agree with the arm, or the wrist breaks.**
  - My first eastern ("palm on the face") grip with a square-faced ready pose needed **141–155°**
    of wrist bend. The hand folded back on the forearm.
  - I searched grip geometry against all key poses. That search chose a hammer/continental grip:
    handle along the knuckle line, face 45° off the palm.
  - The search also found that a natural ready is **backhand-ready**: the backhand face toward the
    net and the head up toward 11 o'clock.
  - Theatre cannot help with this. Any value is allowed, and only the wrist readout warns you.
    A wrist-limit solver would be the next rig feature.
- **Euler props interpolate per channel.** Theatre has no quaternion or orientation prop type.
  - The backhand-ready to forehand-punch turn (aim −150° to −10°) happens to interpolate cleanly:
    the paddle is edge-on at f6 (`punch-volley-takeback.png`).
  - Other key pairs can tumble unless you add breakdown keys.
- **Key positions must use 3 decimals.** The studio rounds positions to 0.001 s. A key written at
  20/24 = 0.833333 got a duplicate key at 0.833 when edited, which made a kink. `author-state.mjs`
  now rounds.
- Studio quirks:
  - It pings `updates.theatrejs.com` hourly; `main.ts` answers that request locally.
  - The sequence editor opens zoomed to about 10 s. Zoom in for 1–2 s clips.
  - The details panel truncates labels longer than about 11 characters.
- **The dink contact is authored with the paddle head about 16° below the wrist**, because that
  keeps the wrist natural. The research table asks for about −40°; push it further in the studio
  if you want.
- The thumb wrap around the handle is approximate (a hinge curl, not opposition).

## Assessment: is Theatre.js a good tool here?

**Pros**
- Very fast iteration on *timing and spacing*:
  - drag keys, shape eases visually, scrub, loop at 0.25×;
  - kinetic-chain offsets are a drag of a few frames per track;
  - this is where code-authored keys are slowest.
- The props→IK approach works. About 10 meaningful controls per shot is a manageable editing
  surface, and the poses read correctly.
- The runtime is small: `@theatre/core` is about 105 kB minified / **35 kB gzip** (measured with
  esbuild, including dataverse).
- The state is plain JSON (bézier handles per key). The 3 motions take 58 kB minified / 8 kB gzip.
  15 shots would be roughly 300 kB minified / 40 kB gzip, or less if you strip it.
- It is easy to read or convert the JSON yourself.

**Cons**
- Theatre knows nothing about anatomy or the ball:
  - wrist plausibility, reach, foot slide and clearance all need checks like the ones in this rig
    and HUD;
  - the contact point is absolute. The game needs contact retargeted to wherever the ball is, so
    keys become a *base* that code bends at runtime;
  - you cannot type "contact point = (x, y, z)" as an input, which the current code-key approach
    can.
- No shared poses or mirroring:
  - the ready pose is copied into every sheet, so changing it means editing 15 sheets;
  - backhand and left-handed variants must come from code;
  - there are no pose libraries and no constraints between sheets.
- Euler-only orientation props (see above). There is also no "copy pose from frame" across sheets.
- **License:**
  - `@theatre/studio` is **AGPL-3.0-only**. It is fine as a local dev tool, but it must never be
    bundled into the shipped or hosted app, or AGPL source-disclosure obligations apply.
  - `@theatre/core` and `@theatre/dataverse` are Apache-2.0.
  - The studio alone is about 771 kB minified / 244 kB gzip.
- **Maintenance:** the last release is 0.7.2, from 2024-05-19 (npm). There has been nothing new
  for about 2.4 years, so treat it as frozen.

**Compared with code-authored keys** (the current `stroke-motion` style)
- Code wins on:
  - diffs and review;
  - parametric contact and shared poses;
  - mirroring and tests;
  - no license questions.
- Theatre wins on feel and timing, because you see and shape the curve.

**Compared with mocap clips**
- Mocap gives weight and secondary motion for free.
- It still needs retargeting to this rig and cleanup.
- It cannot hit an exact contact point without an IK layer on top.
- Pickleball-specific clips are scarce.
- Keyed IK poses give precise control but look stiffer.

**Does props→IK scale to 15 shots?**
- Technically yes. Same objects, 15 sheets, about 60 tracks and 7 keys each.
- Upkeep will hurt where shots share poses (ready, settle), where many orientations go through
  the forehand/backhand flip, and in a variable contact point.

**Recommendation.** Use Theatre (or a lighter clone of the idea) as a **dev-only sketchpad for
timing and easing**:
1. Author or tune one shot in the studio.
2. Export it.
3. Convert the curves into the project's own key-pose format, which the game's own code evaluates
   with contact retargeting and mirroring.

Do not make Theatre the runtime animation system. Never ship the studio. If the team wants a
permanent visual editor, a small in-app key editor on the project's own data model would avoid the
AGPL and maintenance risk, and could hold shared poses and constraints that Theatre lacks.
