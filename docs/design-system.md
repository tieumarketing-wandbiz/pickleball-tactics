# Visual and model decisions

- A tactical court model, not a full rules engine or rigid-body simulation.
- Dark slate workspace, teal court, darker kitchen, chalk lines; warm orange team A and mint team B. Lemon trajectory and selection.
- A full-height desktop scene with a 320 px inspector; mobile court above stacked controls and a fixed bottom timeline. Vietnamese labels, Be Vietnam Pro with system fallback.
- Custom Three.js geometry: meter-scale court, sloping net tape with repeating transparent mesh, capsule players with grounded selection rings, regulation-radius ball and static trajectory tube. No catalog kit or external model was used.
- One hemisphere fill and one directional shadow key at (-7, 15, 6), court and platform receive shadows; players and posts cast them. Shadow frustum fitted to the 18 m platform.
- Scenario state owns player positions and shot parameters. Rendering interpolates presentation poses; pause never commits intermediate poses. Analytic trajectory and net profile are shared by checks and scene.
- Edit mode owns player dragging and direct court clicks for ball destinations; double-click/double-tap selects the hitter. Dragging never changes hitter identity; dragging the hitter updates the shot origin. View mode owns rotation. The optional target button also brings the court into view on mobile. Destinations support out-of-court positions. Pointer capture and cancellation release dragging.
- Sharing uses UTF-8 base64url JSON in the fragment; scenario schema version 1. localStorage is a convenience, JSON is the portable copy.

- Per-shot finisher checkbox controls post-landing bounce/slide; unchecked shots stop at their exact target. The timeline starts a full run from step 1, while the inspector previews only its selected shot. Completed playback holds the final ball pose.

- Shot selector uses the central 15-type registry. Presets assign indicative contact heights/apex and volley defaults; manual editing remains available. ATP/Erne contact is offset 0.55 m toward the sideline from the player, and follows that marker when dragged.
- Full playback keeps the ball visible in a quadratic receive bridge, 0.12–0.65 s depending on distance, then flies the next authored trajectory. The bridge clears the finite net span where it crosses. Hitter motion finishes by contact; partner positions ease over the full clip. Bridges are presentation interpolation, not additional validated ballistic shots.

- Spin controls add none/top/back/left/right and normalized strength; bounce sets restitution 0–0.95. Retarget launch velocity to preserve destination/apex. Frozen-heading Magnus/linear-drag coefficients are illustrative, not measured RPM. Event roots use monotone intervals and bisection. Bounce impulse modifies horizontal retention/kick and reduces spin on subsequent contacts; a procedural ball stripe shows rotation close up. Old JSON defaults to no spin and restitution 0.7.

- Players can move throughout the apron (X ±5, Z ±8.8 m); camera fits outlying player snapshots when needed. The outer floor was raised near the logical ground so out-of-court bounces stay near the visible surface.
- A fixed ball-contact point separates player positioning from the shot origin. Hitter selection after step 1 defaults contact to the previous landing. FH/BH follows dominant hand and team-facing orientation; small articulated arms, paddle, contact ring and heading arrow visualize it. Dominant hand changes propagate across steps for that player.
- Near-net dink fitting raises apex only when clearance is insufficient, with a 12 m cap. Impossible placements retain NET. Bounce-out is separate from first-landing legality and is evaluated with boundary event roots; a dashed orange trail shows the continuation.

- Simplified editor: no handedness picker, manual contact XY/fixed-contact controls, spin-mode/strength selector or restitution input. One Topspin checkbox uses per-shot preset strength; estimated restitution depends on shot class and computed impact speed. Predicted first-bounce height is shown even when the preview stops at landing.
- Add Step creates a new opposing-team shot, choosing the nearest receiver to the previous landing and retaining that landing as the ready-ball origin. The default reply targets the prior sender. Receiver drag/type changes infer contact from the first incoming bounce; Copy Step retains literal data.
