# Validation — phases 1–4

## Built

Vite + TypeScript + Three.js, custom procedural court/net, four labeled capsule markers, edit/view interactions, 15 shot types with editable heights, event-based curved net collision, editable spin/restitution and optional finisher ground bounces and default stop-at-landing, multi-step playback, notes, automatic local save, JSON and URL sharing. Native HTML/CSS UI; no application framework or external 3D assets.

## Numerically checked

`npm test`: **58 passed**. Court dimensions/net profile, snap/clamp, all 15 shot presets landing within 1 cm, apex height, analytic NET and OUT, boundary lines, kitchen/serve/volley warnings, finite net span, invalid inputs, ground bounces, stop-at-landing versus finisher displacement, saved finisher flag and backward compatibility, UTF-8 URL and JSON roundtrips, malformed imports, legacy schema, zero-duration rejection, identity-based player interpolation, continuous/visible receive bridges across three shots, cross-net bridge clearance, partner movement during flight and formation-only ball retention.

`npm run build`: **passed**, including strict TypeScript. App JS 46.11 kB / gzip 17.94 kB; Three.js/OrbitControls 526.01 kB / gzip 131.72 kB. Vite reports its standard >500 kB vendor chunk warning. These are bundle sizes, not measured device performance.

## Browser checked

`npm run test:e2e`: **passed** using Chromium/Playwright against the actual Vite app.

- Desktop 1440 × 950: all 15 shot options present and all ten additions selectable/persisted; orbit changes the rendered frame; drag all four players without changing hitter identity; single-click a player leaves hitter/target unchanged; double-click selects B1; direct court clicks place the fixed hitter destination; choose OUT then in-court destinations; all camera preset buttons; create/copy/delete three steps; single-shot preview leaves the selected step unchanged and holds the final ball position; finisher preview continues past landing; timeline Play starts at step 1 even with step 3 selected, then plays through all steps; pause freezes both clock and the canvas screenshot; resume reaches final step.
- Reload preserves saved scenario; independent browser context opens the shared URL with matching name and step count. JSON download, invalid JSON rejection without changing state, and valid import.
- Mobile 390 × 844 with touch: no horizontal page overflow, view/edit selection, top camera, double-tap hitter selection and touch target placement. Choosing a destination brings the court back into view.
- No uncaught JavaScript errors collected in the desktop test.

Overview frames were rendered, captured and visually inspected for desktop and portrait mobile. Camera fit was refined after initial mobile clipping; player label canvases were resized after small text was observed. Captures can be regenerated in `.playwright/` using the E2E script. Mobile pinch zoom and physical-device GPU performance have not been measured.

## Limits

Prescribed tactical playback with approximate Magnus/linear drag, restitution and spin-sensitive ground retention; no opponents or full rule adjudication. Coefficients are not calibrated against physical pickleballs, and spin percent is not RPM. Kitchen region is separate from OK/NET/OUT. Volley warning derives from shot origin, not a player's feet/momentum. No diagonal serve, two-bounce-rule or turn-order enforcement. Source dimensions use the user's rounded meter values. Phase 5 sample library and Cloudflare deployment are outside this deliverable. Cloudflare Pages build instructions are in README.

Guidance used: 3dviz-pro-max object reasoning, lighting direction/scale and motion/state; custom geometry authored for the brief. No catalog kit or dataset record was retrieved. Court source: [USA Pickleball](https://usapickleball.org/construction/). Three.js control references: [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html).

Playback update: `shot.finish` is an optional boolean (default false, including older JSON). Only finishers retain the existing post-landing bounce/slide. Timeline clips have no extra hold; continuous receive bridges replace the hidden-ball formation phase, and partner movement overlaps flight. A new full run starts at step 1; Pause resumes the same full run. Single-shot preview uses only the current clip, and completion preserves the final ball pose.

Live motion frames captured and inspected in `.playwright/handoff.png` and `.playwright/rally-flight.png`: ball moves through the receive interval while the partner markers change positions. Receive bridges are illustrative interpolation between independent authored shots. Roll/Flick now apply editable topspin presets; ATP/Erne contact offsets do not certify legal footwork.

Spin verification: 11 additional cases test all five spin modes preserving exact authored landing, opposing sidespin curvature, top/back flight-time ordering and post-contact speed, restitution-squared bounce height, floor clearance, zero-restitution stop, two curved net-plane crossings, curved NET clipping, spin/bounce JSON/link roundtrip, old-data defaults and invalid values. E2E selects sidespin, sets strength 80% and bounce 55%, verifies persistence, then runs the full existing interaction/playback suite. Live `.playwright/spin-left.png`, `spin-right.png`, and `spin-bounce.png` were captured and inspected: opposite curves and a ball visibly above the far baseline after first landing. Example first-bounce apex computed as 0.93632 m for restitution 0.8, not a physical calibration measurement.

Sources support the model directions and restitution law, not the chosen gains: [NASA Magnus lift](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-soccer-ball/), [bounce/restitution](https://phys.libretexts.org/Bookshelves/Classical_Mechanics/Classical_Mechanics_%28Tatum%29/05%3A_Collisions/5.02%3A_Bouncing_Balls).

Contact / dink update: five additional unit cases verify outside-court player persistence and legal finite-net ATP, forehand/backhand for both teams and dominant hands, near-net dink fitting with exact landing, impossible placements remaining NET, and an IN cross-court kitchen dink whose subsequent bounce crosses the sideline. `npm run test:contact` passed: outside drag to X 4.2, ATP, fixed contact unaffected by person movement, FH/BH and handedness switch, near-net target, bounce-out status, reload and no uncaught page errors. Full `npm run test:e2e` passed again with a three-step serve/return/drop fixture; choosing the next hitter anchors contact to the previous landing.

Inspected `.playwright/atp-backhand.png`: a right-handed player outside the right sideline receives the ball on the left side, with purple paddle and BH caption. Inspected `dink-bounce-out.png`: first landing inside the kitchen near the sideline, orange dashed bounce continuation outside, with separate IN and bounce-out readouts. Player tokens/paddles illustrate contact and side; they are not full anatomical swing animation. Reach warning is horizontal distance, not a full body collision/footwork solver. Concept references: [USA Pickleball dink](https://usapickleball.org/pickleball-skills/level-two/how-to-dink-and-why-its-important-for-your-success-in-pickleball/), [Selkirk ATP/backhand terminology](https://labs.selkirk.com/blogs/pickleball-education/pickleball-glossary-terms-definitions).

Simplified editor update: five new unit cases verify nearest opposite-team handoff and sender-return target without mutating the previous step, handoff from a formation without a shot, automatic rebound responding to class/apex/contact height while ignoring legacy manual restitution, boolean-only topspin overriding legacy spin, and incoming-bounce contact/FH/BH inferred from receiver movement. Legacy low-level restitution physics tests opt out of automatic estimation explicitly; the UI always uses automatic mode.

Both browser scripts passed. Add Step selects the opposite receiver and starts the ball at the previous landing; all removed control IDs are absent; Topspin check/uncheck persists. Contact tests cover automatic FH/BH, outside-court ATP following an actual incoming dink bounce, predicted rebound, reload, and no page errors. Inspected `.playwright/next-step-ready.png` (ball on B side after A shot) and `automatic-return.png` (outside B receiver, Backhand paddle, ATP around the finite net, one Topspin checkbox and read-only bounce estimate). The bounce predictor uses illustrative shot-class/impact-speed gains, not measured court restitution.
