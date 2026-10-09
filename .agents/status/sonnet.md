# sonnet — status (took over RUNTIME RIG from opus at ~23:35)

State: **working**

## Log (newest first)
- 23:50 Read README v2, opus status, rig.ts/humanoid.ts/players.ts, rig-guide §2-8, anim principles, research §B/§E, video guide.
  Measured the Mixamo asset in app space (scripts: `.agents/scratch/sonnet/measure.ts`). Findings that explain the broken arms:
  * mesh limb radii are much larger than opus' capsules: upper arm r ≈ 0.068–0.075 (not 0.05), forearm 0.046→0.033 (not 0.04), hand ≈0.035–0.05;
  * torso is ≈ round: chest half-width 0.155 × half-depth 0.14 (front z = −0.14, back +0.14), joints sit ≈ 0.046 behind the torso centre;
  * arm reach is short: upper arm 0.276, forearm 0.224 (shoulder→wrist 0.50 m), shoulder joints at x = ±0.172, 0.05 behind the torso axis;
  * READY paddle roll sign made the head lean toward the midline (in front of the face), hands were at the midline with elbows flared → forearms lateral (= "crossing the chest").
  * toe bend not implemented yet.
- Before screenshots: `.agents/scratch/sonnet/before/` (idle.png, drive.png, volley.png).
