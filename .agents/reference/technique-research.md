# Technique research: 15 pickleball shots + pose-to-pose animation (for `stroke-motion` / key-pose rewrite)

Companion to `animation-principles.md` (architecture spec) and `video-guide.md` (measured poses from the reference video).
Written 2026-10-08 from web research. Every claim carries a reference number `[n]` that maps to a URL in the
**References** list at the end. Values marked **[est]** are engineering estimates. They are derived from the cited
qualitative coaching cues, the cited biomechanics numbers and standard anthropometry. No source measured them directly,
so tune them by eye.

## Conventions used in this file

- The player is right-handed and 1.75 m tall. Mirror `y` for left-handers.
- Anthropometry (Drillis & Contini ratios as tabulated in Winter, see [62]): shoulder ≈ 1.43 m, elbow ≈ 1.08 m,
  wrist ≈ 0.84 m (arms hanging), hip ≈ 0.92 m, navel ≈ 1.05 m, knee ≈ 0.50 m. Upper arm ≈ 0.33 m and forearm ≈ 0.26 m,
  so shoulder → grip is ≈ 0.66 m. These ratios are population averages and can be 5–10 % off for any one person [62].
- Paddle: total length ≤ 17 in (0.43 m), and length + width ≤ 24 in [60]. Use 0.40 m, with the face centre ≈ 0.27 m
  from the grip.
- Net height is 36 in (0.91 m) at the posts and 34 in (0.86 m) at the centre [60]. The NVZ lines are 14 ft (4.27 m) apart.
- **Body frame for the numbers** (matches `StrokeVector` in `stroke-motion.ts`): `x` = shot-forward, `y` = hitting
  side (+ = dominant side), `z` = up. The origin is on the ground at the midpoint between the feet. "Hand" means the
  grip centre.
- **Angles:**
  - **face open°**: tilt of the face normal above horizontal. 0 = vertical face, + = open (faces the sky), − = closed.
  - **head pitch°**: elevation of the handle→tip axis. − means the paddle head is below the wrist.
  - **coil°**: chest or pelvis yaw away from the target. 0 = square to the target.
  - **knee°**: knee flexion. 0 = straight.
- **Times:** seconds relative to contact. t = 0 is contact and negative values are before it.

---

## A. Per-shot technique (all 15 shots)

### A0. Shared foundations

- **Grip.** A continental grip (index knuckle at roughly the 45° bevel) for forehand, backhand, dinks and volleys, so the
  player never changes grip at the net [1][3]. Exceptions:
  - Some coaches teach an eastern forehand grip for the topspin roll because it tilts the face for brushing [29c].
  - The backhand flick rotates the fingers slightly "on top" of the handle [28a].
  - The two-handed backhand puts the non-dominant hand above or behind the dominant hand [17][19].
- **Grip pressure.** Light, about 3–4 out of 10 for blocks and dinks [26a][3]. The wrist is firm and the grip is loose
  ("the paddle could slide out") [5].
- **Ready position.**
  - Knees slightly bent [5].
  - Paddle out in front of the chest, not down by the legs [5]. Some coaches now hold it nearer the navel [6].
  - Elbow slightly bent, with the arms "neither locked out nor tucked in" [6].
  - Paddle tilted toward the backhand at about 11 o'clock for a right-hander [5].
  - Return to this position after every shot [5].
  - The measured video ready pose is: paddle at sternum height (1.1–1.3 m), 0.25–0.35 m in front of the chest, head up
    45–70°, elbows ≈ 90° (`video-guide.md`).
- **Split step.**
  - Start the hop just before the opponent's contact, so the player is in the air while the ball is on the opponent's
    paddle and lands as it leaves [8].
  - The hop is small, about 2–4 in (5–10 cm) [9].
  - Watch the opponent's paddle, not the ball [9].
  - Splitting too early leaves the player flat-footed. Splitting too late leaves them airborne as the ball arrives [8][9].
- **Unit turn.** Hips, shoulders and the non-dominant arm turn together as one unit, and the paddle moves with the
  chest [15]. Turn early so the body is coiled before contact [14].
- **Kinetic chain (tennis forehand, the closest measured analogue)** [33a]:

  | Event | Elite players | High-performance players |
  |---|---|---|
  | Pelvis peak angular velocity | −75 ms | −93 ms |
  | Trunk peak angular velocity | −57 ms | −75 ms |
  | Horizontal racquet-head velocity peak | ≈ −2 ms | ≈ −3 ms |
  | Shoulder internal-rotation peak | +24 ms | +24 ms |
  | Forward swing duration | 0.324 s | 0.326 s |
  | Peak racquet speed | 33 m/s | 31 m/s |
  | Maximum hip–shoulder separation | 27° | 33° |

  - Elite players reach the pelvis and trunk peaks *later*, which gives them more racquet speed [33a].
  - Proximal-to-distal ordering is clearer in when each joint *starts* moving than in when each reaches peak velocity,
    and it varies by skill [33f][33g].
  - When precision matters, as in the volley, the segments work more as a single unit [33e].
  - The pause between backswing and forward swing should be short, because stored elastic energy is lost if it is
    delayed [33e].
- **Contact in front.** Nearly every source puts contact in front of the body. Contact level with or behind the hip is the
  most common fault on every shot [3][16][24a].

### A1. Serve (underhand volley serve)

- **Rules (USA Pickleball 4.A, 2026 wording adds "clearly")** [10]:
  - Contact at or below the navel.
  - The highest point of the paddle head is below the highest point of the wrist.
  - The paddle moves in an upward arc at contact.
  - Spinning the ball with the release hand is illegal.
  - A drop serve (ball bounced before the hit) is exempt from the motion and height limits [10].
- **Grip and hands.** Continental or a slightly eastern grip [13]. One-handed.
- **Stance.**
  - Staggered, about shoulder width, non-dominant foot forward, non-dominant shoulder toward the net [13].
  - Weight on the balls of the feet. Toes slightly toward the kitchen [11].
- **Load.**
  - Moderate coil ("twisted rubber band", not a forced twist) [11].
  - More weight on the back leg and knees flexed [13].
  - The video measures a shoulder turn of 30–45° and the paddle 0.35–0.5 m behind the hip at knee–hip height, with a
    straight-arm pendulum.
- **Swing.**
  - Pendulum from the shoulder with a small wrist snap at contact [13].
  - Contact around knee height in one guide [13]. The video measures 0.45–0.6 m above ground and 0.35–0.5 m in front of
    the front foot.
  - Face roughly perpendicular to the court [13].
- **Weight transfer.** From back foot to front foot, often with a small forward step of the front leg [13].
  - Drive the weight *toward the target, not sideways* [12].
  - A front-loaded variant (less rocking) gives a more repeatable serve [12].
- **Follow-through.** Continue toward the target and up. For topspin, the back of the wrist ends facing the cheek [13].
  The video measures the hand ending at head height or above (1.6–1.9 m).
- **Off arm.** Holds the ball in front of the body at about waist height, releases it (no spin from the fingers [10]), then
  swings out and back for balance **[est]**.
- **Kinetic chain.** Legs → hips → trunk → shoulder (pendulum). The wrist snap comes last [13].
- **Faults.**
  - Swinging across the body, which makes the head-below-wrist and upward-arc rules hard to keep [10].
  - Sideways weight transfer [12].
  - Contact too high. Borderline contacts are now faults [10].

### A2. Drive (forehand; backhand one- or two-handed)

- **Forehand.**
  - Athletic stance, then an early unit turn of shoulders and hips [14][15].
  - Short, compact backswing. A big backswing ruins timing [14].
  - A closed stance is recommended for learners because it forces the whole body to turn [15].
  - Contact slightly in front of the body at about waist height [14], in front of the hip and not beside it [16].
  - Path is low to high with a slight upward brush for topspin [14].
  - Legs stabilise, the hips and torso rotate, then the arm and paddle follow [15].
  - Follow-through finishes toward the target and up, ending above the shoulder [15]. Let the paddle decelerate
    naturally and do not force a dramatic wrap [16].
  - Recover to ready quickly [14].
- **Coil numbers.** Pickleball has no measured value. Tennis forehands reach about 27–33° of hip–shoulder separation [33a].
  For pickleball's shorter swing use a chest coil of 60–80° and a pelvis coil of 35–50° at load **[est]**.
- **Off arm.**
  - Turns with the shoulders in the unit turn [15].
  - Points toward the ball to judge spacing and keep contact out in front [33c][33d].
  - Stays above the hitting hand rather than dropping [33d].
  - Then folds in across the chest as the trunk rotates, braking the trunk so the arm can whip **[est]**, a standard
    tennis cue consistent with [33c][33d].
- **Backhand, two-handed ("twoey").**
  - **When to use it** [18][20][17]:
    - Baseline drives and returns.
    - Balls wide to the backhand corner.
    - Hands battles aimed at the non-dominant shoulder, where it adds stability, power and topspin.
    - Defending in the transition zone (absorbs pace).
  - **When to switch to one hand** [18][20]:
    - A ball at the body with no time to move.
    - A stretched reach.
    - Middle balls, where the one-handed counter adjusts better.
  - **Grip** [17][19]: dominant hand low on the handle, non-dominant hand above or behind it, sometimes with the index
    finger on the face.
  - **The non-dominant hand does most of the work** [17].
  - **Backswing** [17][19]: compact. Shoulder turn until the dominant shoulder reaches the chin [17]. The paddle starts
    near the back hip [19].
  - **Swing** [17]: the hips lead and the upper body stays quiet. The paddle tip dips for spin and the non-dominant hand
    is thrown across the body.
  - **Contact**: in front of the body with both arms extending forward [19]. Slightly in front of the lead hip with room
    for both arms [19]. On counters, set the paddle about 6 in in front of the lead shoulder [21].
  - **Follow-through**: low to high, but not over the shoulder on returns [19]. Short [17].
- **Faults.**
  - Big or looping backswing [14][19].
  - Arm-only swing [15].
  - Late contact beside the hip [16].
  - Rising too early [19].
  - Over-hitting [14].

### A3. Dink (forehand and backhand)

- **Grip and stroke type.** Continental, the same grip on both wings [1][3]. Light pressure [3]. One-handed. Some players
  use two hands on backhand topspin dinks [18].
- **Stance.**
  - Get low with bent knees and a straight back. Do not bend at the waist with stiff legs [1].
  - Push forward from the legs [1].
  - Move the feet to wide dinks [1].
- **Swing.**
  - "More of a gentle push than a swing" [1].
  - Very short backswing that never goes behind the body. A short, compact follow-through returns quickly to ready [1].
  - The motion is shoulder-guided with a quiet wrist [3].
  - Over-rotating the shoulder on the follow-through is a common error at the 3.5–4.0 level [3].
- **Contact.**
  - Out in front, roughly 12–18 in (0.30–0.46 m) ahead of the front foot, or about one paddle length in front [2][3].
  - The video measures 0.5–0.7 m ahead of the lead foot and 0.3–0.5 m above ground.
- **Face angle.** Coaches disagree, from "slightly open" to "neutral" [3]. The video measures 35–45° open on a deep dink.
- **Target.** Net clearance about 1–1.5 ft [1].
- **Topspin dink variant** (see A12, roll) [4]:
  - Forearm-driven, with the tip starting down and the face slightly closed.
  - U-shaped path that brushes up toward the ear.
  - The body moves forward as the forearm rolls.
  - Do not crowd the ball.
- **Off arm.** Out in front near the paddle throat for balance **[est]**, consistent with the video's off hand near the
  throat.
- **Faults.**
  - Letting the ball drift back to the hip, which forces a wrist correction [3].
  - Long backswing or follow-through [1][3].
  - Tight grip, which pops the ball up [3].
  - Standing tall [1][4].

### A4. Drop (third-shot drop)

- **Grip and stroke type.** Continental. One-handed. Some players use a two-handed backhand.
- **Setup.** Turn the shoulder rather than squaring up. Slightly open face. Swing from the shoulder with a neutral,
  unbroken wrist [22a].
- **Swing.**
  - Starts low near the knees and lifts gently through the ball with little forward push [22b].
  - The face stays stable and relaxed [22c].
  - Let the ball fall into the paddle, then follow through toward the target with slight backspin [22b].
- **Arc.** The ball peaks before the net and lands deep in the kitchen [22c].
- **Weight.** Transfer forward. Never hit while backing up [22a].
- **Head.** Keep the eyes on the contact point until the ball leaves the paddle [22b].
- **Faults.**
  - Falling backward.
  - Lifting the head early.
  - Popping the ball up, which is worse than netting it [22a][22b].
- **Numbers [est].**
  - Contact 0.4–0.8 m high and 0.2–0.4 m in front of the lead hip.
  - Face open 20–30°.
  - Backswing ≤ 0.3 m behind the hip.
  - Follow-through ends at chest height toward the target.

### A5. Lob (offensive, off the bounce or a volley lob)

- **Disguise.** The lob should look like a dink until the last moment: same stance, same backswing [23a].
- **Contact.** Get slightly under the ball and brush upward. A little topspin brings the ball down after it clears the
  opponent [23b].
- **Follow-through.** Ends pointing at the sky. A dink's follow-through points at the target [23a]. A low finish produces a
  flat, smashable ball [23a].
- **Pace.** Controlled. Too much pace is the main reason lobs go out. A big backswing tips off the opponent [23b].
- **Target.** Over the opponent's non-dominant shoulder, into the back third of the court [23b].
- **Forehand vs backhand.** The forehand lob is easier [23b].
- **Numbers [est].**
  - Face open 45–60° at contact.
  - Head pitch rises from −20° at load to +60° at follow.
  - Hand finishes at or above head height.

### A6. Volley (generic neutral volley) and A7. Punch volley

- **Motion.**
  - Almost no backswing. "Karate chop, not a swing" [24a].
  - The paddle travels 6–12 in (0.15–0.30 m) [24a].
  - Energy comes from the shoulders shifting forward, not a wrist whip [24a].
  - Some coaches let the elbow drive forward with a locked wrist [24b]. Others keep the elbow and wrist quiet [24a].
- **Contact.** In front. At the hip is already too late [24a].
  - An elbow bent more than 90° at contact means the ball was too close.
  - A fully straight arm means the player reached too early [24a].
  - The video measures contact 0.45–0.6 m in front of the chest at chest–shoulder height, elbow 150–170°, face about
    vertical.
- **Face.** Show the face to the target longer than feels natural [24a]. On the forehand the palm leads. On the backhand
  the knuckles lead [24a].
  - On the backhand punch, the paddle sits in front of the *opposite* hip to make room [24b].
  - Tennis analogue: keep the elbow bent and slightly out in front of the body, with a minimal backswing [33h].
- **Punch.** Same structure, firmer. The video measures 0.2–0.3 m of travel along the target line with the finish held
  about 0.15 s.
- **Timing analogue.** Skilled tennis volleys at the most comfortable (middle) contact location measured 0.249 s of
  "pushing time" and 0.466 s of total stroke time [33b]. Pickleball volleys are shorter still.
- **Faults.**
  - Big backswing (the most common net fault) [33h].
  - Wrist rolling early [24a].
  - Contact at the hip [24a].

### A8. Smash (overhead)

- **Footwork.**
  - Pivot the non-dominant foot back on reading the lob, then side-shuffle or cross-step. Never backpedal with crossed
    feet [25a][25c].
  - Get behind the ball, not under it, so it would land about 1–2 ft in front of the hitting shoulder [25a].
- **Trophy position.**
  - Upper arm about horizontal with the elbow near 90° [25b], at about ear level and up, not tucked [25a].
  - Paddle head tilted back behind the shoulder [25a].
  - Shoulders sideways to the net [25a].
  - Non-hitting arm straight up and pointing at the ball. It tracks the ball, rotates the shoulders and keeps the chest
    from opening early. Do not drop it early [25a][25b][25c].
- **Contact.**
  - Slightly in front of the hitting shoulder at the highest point the player can reach while staying balanced. Reach up
    and forward [25a].
  - The face angles slightly downward [25a].
  - Sources disagree on the wrist: snap for topspin [25a], or wrist only sets the face angle [25c]. Use a modest snap.
  - The video measures the arm fully up, hand 0.3–0.4 m above the head and 0.3–0.5 m in front.
- **Follow-through.** Down and across the body to the non-dominant hip [25a]. Weight moves forward. Jumping overheads are
  high-risk, so keep the feet down [25a].
- **Kinetic chain.** Shoulder girdle → torso rotation → wrist [25c].
- **Faults** [25a]:
  - Backpedalling.
  - Standing under the ball.
  - Drifting backward.
  - Late preparation.
  - Dropping the off arm.
  - "Punching the sky" (contact behind the head).
  - A jabby finish.

### A9. Block (block volley)

- **Purpose.** An energy absorber, not a counterattack. "Catcher's mitt, not a bat" [26a].
- **Motion.**
  - From ready, rotate the paddle into the block *before* the ball arrives and let the ball come to the face [26a].
  - The face is usually slightly open on both wings [26a].
  - Grip about 3–4 out of 10, firming slightly at impact [26a][26b].
  - Wrist quiet [26a].
- **Contact.** In front of the body, not beside the hip [26a].
  - The backhand block is often easier because the paddle stays in front and the elbow stays stable [26a].
  - Keep the paddle out front but "connected". Do not lift the elbow high [26a].
- **Faults.**
  - Rising through the shot, which pulls the paddle off the ball [26a].
  - Stiff, too vertical, too much wrist tension [26a].
- **Numbers.** The video measures about half extension with no follow-through.

### A10. Reset

- **Purpose.** A soft shot from the transition zone or mid-court into the NVZ that neutralises an attack [27a][27b].
- **Technique.**
  - Soft grip, face slightly open, paddle out in front [27a][27b].
  - Knees bent and staying low [27b].
  - Take the ball early with the face slightly open [27c].
  - A "soft pocket" lets the ball compress on the face [27c].
  - No backswing [27d].
- **Ball height.** Often at the feet, so the motion is short and compact with a high, soft arc. Move forward afterwards [27a].
- **Faults.** Tight grip (pop-up) [27d]. Aiming for corners under pressure [27a].
- **Numbers [est].**
  - Contact 0.2–0.5 m high.
  - Face open 20–35°.
  - Knee 55–70°.
  - Pelvis drop 0.2–0.3 m.
  - Follow-through lift 0.1–0.2 m.

### A11. Speed-up (attack from the dink rally)

- **Disguise.** It looks identical to the player's dink until it accelerates [28d]. Two-handed backhand speed-ups disguise
  it better [18].
- **Set and snap.** Set the wrist position completely *before* the forward motion starts, then snap. A snap through the
  ball adds pace and a snap upward adds spin [28c].
- **Targets.** Hips or the paddle-side shoulder ("chicken wing") [28a].
- **Faults.** Too much wrist from below net height goes into the net [28a].
- **Numbers [est].**
  - Wrist extended 30–45° at load.
  - Contact knee to waist height, ideally a ball at or above net height (0.86 m).

### A12. Roll (roll volley / topspin dink)

- **Mechanics.**
  - The paddle head must drop below the ball, then brush up. Without the dip the shot becomes a half punch, half
    roll [29b].
  - The path is a U or horizontal figure-8 that ends high [29c][4].
  - The arm and shoulder do the work. Do not flick the wrist [28a][29a].
- **Face.** Ben Johns keeps it slightly open and warns that closing it won't grip the ball [29a]. Other sources describe a
  closed face [28a]. Use about 0–15° open.
- **Contact.** In front, with the knees bent [29b].
- **When to use it.** On rising or floating balls and balls with pace [29a].
- **Follow-through.** Brush up toward the ear [4]. Finish the swing, because a truncated finish kills topspin [29c].

### A13. Flick (backhand wrist flick)

- **Setup.**
  - Paddle tip down, elbow up, wrist cocked back. An elbow tuck adds speed [28a].
  - USA Pickleball describes the paddle diagonally down with the wrist fully "broken" back and a straight arm [28b].
- **Swing.**
  - Snap the wrist forward, not sideways (no windshield-wiper) [28a].
  - Brush low to high for topspin. The wrist returns to neutral at contact [28b].
  - Cue: throwing a frisbee without letting go [28b].
- **Use.** On balls below net height and on high dinks reachable without stepping into the kitchen [28b][28d].
- **Kinetic chain.** Inverted relative to other shots: the body is quiet and the wrist is the main driver [28b]. See the
  C4 offsets.

### A14. ATP (around the post)

- **When.** Only when a wide ball pulls the player outside the sideline [30a][30c].
- **Footwork.**
  - Sprint laterally on the first sign of the angle and commit early [30a][30c].
  - Use an open stance toward the net if possible rather than a crossover. Fast, spinning balls may force turning and
    running [30c].
  - On the forehand, the outside leg is the base and lever [30b].
- **Body position.** Outside the sideline with a clear swing path [30a]. Stay low because contact can be very near the
  ground [30c].
- **Swing.** Compact, like a firm push or controlled drive, not a loop [30a][30b]. Face slightly open [30a].
- **Timing.** Wait until the ball has travelled far enough outside the post and dropped low enough before swinging.
  Swinging early is the #1 error [30b].
- **Recovery.** Recover immediately [30a].

### A15. Erne

- **Legal forms** [31b]:
  - **Roundabout**: run around the NVZ and plant outside the court.
  - **Step through**: both feet planted outside before contact, contact before the net plane, and no falling into the
    NVZ.
  - **Jump**: contact in the air, landing outside the NVZ.
- **Footwork.**
  - Lead with the *close* leg (the one nearest the post), turning that foot slightly out, then push off and go around [31a].
  - Hips stay square. Turning sideways is the main error [31a].
  - Stepping with the far leg first rotates the hips and the trail foot clips the kitchen [31a].
- **Timing.** Start just as the opponent commits to a predictable line dink [31a][31c]. Do not drift early, which
  telegraphs the move [31a].
- **Swing.** A small, volley-type swing. Use the backhand for balls near the sideline and the forehand for more central
  balls [31a].
- **Faults** [31a]:
  - Leading with the wrong foot.
  - Moving late.
  - Moving early.
  - Attempting it on high or central balls.
  - Landing in the NVZ.

---

## B. Arm and body clearance (fixing "IK arms stick to the torso")

What the sources say:

- **Ready position.** The paddle is out in front of the chest [5], the elbow slightly bent, and the arms "neither locked out
  nor tucked in". Arms pressed against the body jam shots and leave no time to react [6].
- **Spacing.** The tennis non-hitting arm points at the ball "like radar" to set spacing, so contact happens out in front
  and the player is not cramped [33c][33d]. Coaches drill keeping the arm and racquet slightly away from the body
  [33i].
- **Contact.** Contact is in front of the hip, never beside it, on drives [16], dinks [3] and volleys [24a]. The backhand
  punch paddle sits in front of the *opposite* hip "to create room" [24b].
- **Blocks.** The elbow stays "connected" (not lifted high) while the paddle is out front [26a]. This is the one case where
  the elbow is close to the body. It is still in *front* of the torso plane, not glued to the side.
- **Chicken wing.** A high elbow with a backhand taken on the forehand side is the fault opponents target [32a][32b].
  Keep the elbow below shoulder height except on overheads and high backhand volleys.

Recommended numbers **[est]**. No source measures these distances. They are derived from the cues above, the video's
"elbows ~90°, paddle 0.25–0.35 m in front of the chest", and 1.75 m anthropometry.

| Phase | Elbow → nearest torso surface | Hand (grip) → torso surface | Notes |
|---|---|---|---|
| Ready | 0.12–0.20 m lateral and in front of the ribs. The elbow sits 0.10–0.20 m *forward* of the torso plane. | 0.25–0.40 m in front of the sternum | Upper arm about 20–35° out from the trunk (abduction) and 20–40° forward (flexion). Elbow 80–100°. Off hand near the throat, also ≥ 0.25 m out. |
| Forehand load (drive, serve) | ≥ 0.15 m. The elbow is behind and lateral to the hip, never inside the body silhouette. | ≥ 0.35 m behind or lateral to the hip | Arm "slightly away from body" [33i] |
| Forehand contact | ≥ 0.25 m | 0.55–0.70 m lateral from the body centreline, 0.3–0.5 m in front of the hip | Arm almost extended. Elbow 140–170°. |
| Backhand load (one-handed) | Elbow in front of the chest, ≥ 0.10 m from the sternum | Hand at the opposite hip, ≥ 0.15 m in front of it | The paddle crosses the body *in front*, not through it |
| Volley / punch / block contact | ≥ 0.15 m (block ≥ 0.10 m) | 0.45–0.60 m in front of the chest | Elbow 110–160° |
| Dink / reset / drop contact | ≥ 0.20 m (the arm hangs forward and down) | 0.35–0.60 m in front and below the knee–hip line | The torso leans forward, so test against the leaning capsule |
| Follow-through across the body (drive, smash) | The elbow may come within 0.08–0.12 m of the chest at the end | The hand passes ≥ 0.15 m in front of the chest or hip | Real players fold the arm *in front of* the body, so do not push the hand outward here. Push it forward. |

Mechanism used by real players: the arm does not avoid the body by itself. The *trunk rotates out of the way*. On a
forehand the chest turns square or past square at contact. On a backhand the chest stays more side-on. The arm moves
on a radius set by the shoulder, so collisions in a rig usually mean one of these:

1. The torso has not rotated enough at that moment, for example because of chain offsets that leave the chest lagging
   too much while the hand target has moved.
2. The IK pole (swivel) points the elbow inward or down into the ribs.
3. The hand target is too close to the body because the contact point was placed beside the hip.

Fix all three (see D3).

---

## C. The 12 principles applied to a pose-to-pose paddle swing

Principle definitions come from Thomas & Johnston, *The Illusion of Life*, as summarised in [40]. Spacing and easing
follow the slow-in/slow-out principle [40] and the Survival Kit timing/spacing summaries [41].

### C1. Key poses and breakdowns (pose-to-pose, not straight-ahead)

Slow phases are blocked as key poses and fast phases are bridged with breakdowns. This is the normal hybrid for
pitching and batting swings [42].

| Key | Content | Applies to |
|---|---|---|
| `ready` | Shared athletic ready (A0) | All shots |
| `anticipation` | Split-step landing, weight dip, unit-turn start, and a small move *opposite* to the swing (for example, weight back before forward) [40][42] | serve, drive, drop, smash, speedup, erne, atp (the run) |
| `load` | Backswing extreme, the drawing that sells the shot | All shots. For block it is just "face set". |
| `breakdown` | Forward-swing passing pose. Hips already open, hand lagging, paddle head lowest (low-to-high) or behind (overhead). Defines the arc. | All except block |
| `contact` | Exact paddle-face-at-ball pose (IK-exact) | All shots |
| `follow` | Follow-through extreme. Its silhouette identifies the shot (C8). | All shots |
| `settle` | 5–10 % overshoot back toward ready, then a spring into ready | All shots |

Game-animation framing: anticipation, apex (contact), recoil. Player-character anticipations are kept short for
responsiveness, while NPC anticipations are longer to telegraph the move [43]. A tactics viewer is "NPC-like": keep
readable anticipation, but scale it to the time available (D5).

### C2. Timing

- **Tennis forehand.** The forward swing takes about 0.32 s [33a]. The total preparation is long and slow and the
  forward swing is short and fast [33j]. A biomechanics review warns that the backswing→forward-swing pause must be
  short [33e].
- **Recommended for pickleball [est]:**
  - Forward swing (load → contact) T_f is 0.20–0.26 s for drive and serve. Pickleball backswings are compact [14][1].
  - T_f is 0.12–0.20 s for dink, drop, lob, reset and roll.
  - T_f is 0.06–0.12 s for punch, block, flick and erne.
  - Follow-through takes about 1.0–1.3 × T_f.
  - Recovery to ready takes 0.3–0.5 s.
- **Holds.** The `load` pose gets a *moving hold* of 0.03–0.06 s with 2–4 % drift, never a dead stop [33e][40]. The
  punch keeps its finish hold of about 0.15 s (video).

### C3. Spacing and easing (slow-in / slow-out)

| Segment | Recommended easing | Why |
|---|---|---|
| `ready → anticipation` | easeInOutSine | Gentle start from rest |
| `anticipation → load` | easeOutCubic. Fast departure, slow arrival into the extreme. | Slow-in to the strongest drawing [40] |
| `load → breakdown → contact` | One accelerating curve, power 2–2.5 (easeInQuad to easeInCubic). Breakdown sits at about 60–65 % of T_f in time but only about 35–40 % of the path distance. | Speed rises until contact. The peak racquet-head speed is essentially *at* contact [33a]. Never ease out into contact. |
| `contact → follow` | easeOutCubic (deceleration). The initial velocity must equal the incoming velocity (C¹ continuity). | Natural deceleration [16] |
| `follow → settle` | easeOutBack with overshoot s ≈ 1.2–1.5 (≈ 5–10 %), or a critically damped spring with half-life 0.08–0.12 s | Settle and overshoot without wobble [44] |
| `settle → ready` | Critically damped spring, half-life 0.10–0.15 s | Robust to retargeting mid-flight [44] |

The Penner/easings.net families are standard references for these curves [45]. For the contact segment, a
**Hermite segment** with an explicit tangent at contact is usually better than stitching two eases. Set the tangent to
`v_contact = k · (follow − load) / (T_f + T_follow)` with k ≈ 1.6–2.0 **[est]**. That guarantees continuous velocity
through t = 0 and makes it the fastest moment.

### C4. Overlapping action, drag and follow-through: per-joint phase offsets

Each body part samples the key timeline at `t − Δ_part`. Δ is expressed as a fraction of T_f, and Δ is *blended to 0*
inside the last 15 % of T_f before contact so the contact pose stays exact. After contact, the distal parts *overtake*:
the paddle head leads, and the proximal parts stop first.

The forward-swing values for power shots below are derived from [33a]:
- Pelvis peak at 75 ms and trunk peak at 57 ms before contact, against a T_f of 324 ms, gives pelvis→trunk ≈ 0.06 T_f.
- Pelvis→hand ≈ 0.23 T_f.

| Part | Power shots (drive, serve, smash, speedup, lob off a deep ball) | Touch shots (dink, drop, reset, block, punch, volley, roll, erne) | Flick (wrist-dominant) |
|---|---|---|---|
| pelvis | 0 | 0 | 0 |
| chest | +0.06 | +0.02 | +0.02 |
| upper arm | +0.12 | +0.03 | +0.04 |
| forearm | +0.17 | +0.04 | +0.06 |
| hand / wrist | +0.22 | +0.05 | +0.25 (wrist set, then snap in the last 30 %) [28b][28c] |
| paddle head (drag) | +0.26 | +0.05 (locked wrist [3][22a]) | +0.30 |
| head (gaze) | Locked on the ball. Keeps tracking the contact point ≈ 0.1 s after contact [22b]. | Same | Same |

- **Takeback.** The unit turn moves the shoulders, chest and paddle *together* (Δ ≈ 0) [15]. The pelvis lags the chest
  by about +0.10 of the takeback duration, which creates the 25–35° separation at load [33a].
  - With a relaxed wrist, the paddle head lags the hand by about +0.05 going back. This is the "drag" that becomes
    lag [46].
- **After contact.**
  - The pelvis reaches its follow pose first (Δ_follow −0.10).
  - The chest follows (−0.05).
  - The hand and paddle arrive last and overshoot 5–8 %.
  - This is follow-through and overlapping action [40][47].
- **Readability.** For a tactics camera, multiply the power-shot offsets by 1.1–1.3 (C9).

### C5. Arcs

- Natural motion travels in arcs and only mechanical motion moves in straight lines [40][47]. The swing is a set of
  rotations about the shoulder and the trunk.
- Interpolate the **hand position** through `load → breakdown → contact → follow` with a *centripetal Catmull-Rom*
  (α = 0.5). It does not overshoot or cusp the way uniform Catmull-Rom does **[est]**.
- Interpolate the **paddle orientation** with a squad or slerp chain on the same parameter.
- Check:
  - The hand path is non-collinear.
  - The radius of the paddle-head arc is ≥ the radius of the hand arc. The head travels farther, because of drag and lag.
  - The serve, drop, lob, roll and flick paths are *concave up* (low → high) through contact [13][22b][23b][29b].

### C6. Secondary action

The secondary action must emphasise the main action, not compete with it [40][47].

- **Off arm:**
  - Drive: points or tracks the ball at load, then folds across the chest during rotation [33c][33d].
  - Smash: points straight up at the ball until just before contact, then tucks [25a][25b].
  - Serve: releases the ball, then balances.
  - Twoey: stays on the handle.
  - Dink, volley and block: hovers in front near the paddle throat.
- **Head:** tracks the ball and stays down through contact [22b].
- **Overhead shoulder shrug:** a small elevation of the shoulder girdle **[est]**.

### C7. Squash and stretch for a realistic character

There is no volume change. Use only spine compression and extension [40].

- **Load:** pelvis drop 3–8 cm, chest pitch forward 5–10°, knees +10–15° deeper than ready.
- **Contact:** extension of 2–5 cm, *only* on serve, drive, smash and speedup.
- **Dink, reset, block, drop and ATP stay low through contact.** Rising through the shot is a listed fault [26a][1][30c].

### C8. Staging and silhouette (top-down and 3D cameras)

The follow-through end pose is the most distinctive shot identifier [23a][25a]. Make sure every shot's `load` and
`follow` puts the paddle *outside* the torso outline from above:

| Shot | Load silhouette | Follow silhouette |
|---|---|---|
| Drive | Paddle behind the hip line | High, across the body |
| Dink | Paddle low, in front | Short lift *toward the target* |
| Lob | Same as dink (disguise) | Paddle *pointing at the sky* [23a] |
| Punch | — | Short, held, out in front |
| Block | — | Almost no change |
| Smash | Paddle behind the head with the off arm up | Down to the opposite hip [25a] |
| Serve | — | High, toward the target |
| Erne / ATP | Read from the body path (lateral translation) and contact outside the court lines | — |

### C9. Exaggeration

- Multiply load and follow amplitudes by +10–20 % (one global constant), as in the spec.
- **Do not exaggerate:**
  - The touch-shot backswing. A short backswing is the defining cue [1][14].
  - Serve contact height or the head-below-wrist rule [10].
  - Foot placement relative to the NVZ on erne and ATP [31a][31b].

### C10. Solid drawing, weight and balance (no twinning)

- Avoid mirrored "twins": symmetrical arms, legs or timing [40][48a][48b].
- Use staggered feet on every shot.
- Weight is 60–70 % on the back foot at load for drive, serve, drop and smash, and 60–70 % on the front foot at
  contact [13][22a][25a].
- Tilt the shoulders: the hitting shoulder is lower on low balls and higher on overheads.
- The off arm is never a mirror of the paddle arm.

### C11. Appeal

- No jitter or pops between shots. Blend from the previous `settle` into the next `anticipation` with inertialization
  [44][50].

---

## D. How sports games and procedural systems do it (implementable recommendations)

1. **Keyed pose tables + interpolation.**
   - Overgrowth's procedural animation (GDC 2014 Animation Bootcamp) drove a whole character from very few keyed poses
     with procedural interpolation and springs layered on top [49a][49b].
   - Recommendation: a per-shot `KeyPose[]` table (E1), evaluated by the C3 easing and C5 splines, with the C4 per-part
     time offsets.
2. **Parameterise by contact location, then IK-correct.**
   - Sports titles author several swing variants per stroke. TopSpin 2K25 used 9 animations per forehand or backhand
     style, varying by ball height and the player's approach direction and speed [51].
   - A common technique is to blend 4 corner swings (plus a centre one) to hit any point in a contact square, then add IK
     for the exact point and face angle. Contact frames are tagged in the data [52].
   - Recommendation:
     - Author `low` and `high` variants of `load`, `contact` and `follow` per shot, and bilinearly blend by normalised
       contact height and reach.
     - Then apply a **distributed IK correction**. Compute `δ = required_hand_at_contact − blended_hand_at_contact` and add
       `δ · w(t)` to every key. `w` is a smooth bump: 0 at `anticipation`, 1 at `contact`, 0 at `settle`. This keeps the
       contact exact without a visible snap.
     - The required hand position is `ball − R_paddle · faceCentreOffset` (≈ 0.27 m along the shaft).
3. **Two-bone arm IK with explicit swivel (pole) control plus clearance.**
   - Two-bone solvers take a pole or swivel target that defines the elbow plane [53a][53b].
   - Per-key pole directions (body frame) **[est]**:
     - Forehand: down, out and slightly back.
     - Backhand: out and forward.
     - Smash trophy: out and up, with the elbow at ear level [25a].
     - Ready and volley: down and out at 30–45°.
   - Interpolate the swivel *angle* (a scalar about the shoulder→hand axis) rather than lerping pole points. Clamp it to
     the anatomical range.
   - After solving, run a **clearance pass** against torso capsules (pelvis, waist, chest) as specified in
     `animation-principles.md` §3:
     1. Rotate the swivel outward in 5° steps until the elbow and forearm segment clear the capsules (≤ 6 steps).
     2. If the hand itself is inside, push the hand target out along the capsule normal. Use *forward* for
        across-body follow-throughs (B).
     3. Never move the hand at contact. Instead, rotate the chest yaw toward square, or step the pelvis back. The
        existing `reach` logic already steps the body back.
   - Filter the swivel with a critically damped spring to avoid flicker near full extension [44].
4. **Foot locking.**
   - Detect plant phases (low foot speed), pin the foot's world position while planted, and solve the leg with two-bone
     IK [54a][54b]. Fixed velocity thresholds fail across motion types [54c], so author plant flags per key instead.
     Locking hides small speed mismatches. Horizontal sliding needs stride or play-rate matching [54b].
   - Per-shot plant schedule **[est]**:
     - Drive and serve: the back foot is planted from `anticipation` to `contact` (heel may lift and pivot). The front
       foot steps and plants at about −0.15 s and stays planted to `settle`.
     - Dink, reset and block: both feet planted. Allow a ball-of-foot pivot only.
     - Smash: drop step at `anticipation`, shuffle, plant both feet by `load`.
     - ATP: run cycle, then plant the outside leg at `breakdown`.
     - Erne: close leg first, push or jump, and land after contact. No plant at contact for the jump variant.
   - Blend lock weights in and out over 0.05–0.08 s.
5. **Transitions and responsiveness.**
   - Use inertialization (decay the pose offset with a spring) instead of cross-fading two animations [50][44]. It is
     cheaper and keeps velocity.
   - Because the tactics app *knows* each contact time in advance, schedule keys backward from contact.
   - If the available time `T_avail` (from the opponent's contact, or the split-step landing, to own contact) is less
     than the nominal `|t_anticipation|`:
     1. Drop `anticipation` first.
     2. Then compress `load` toward contact, but never below the minimum T_f in E1.
     3. Then shrink the load amplitude. This matches real compact swings under pressure [33h][24a].
   - Example **[est]**: in a kitchen firefight at about 17 m/s over 4.27 m, `T_avail` ≈ 0.25 s, which is why block and
     punch keys sit inside −0.10 s.
6. **Motion matching** (Ubisoft [55]) is unnecessary for this app's scale. The key-pose table plus IK is the right
   complexity [49a].

---

## E. Summary tables (programmer-ready)

### E1. Key-pose timings (s, contact = 0) and minimum forward swing

"—" means the key is not used. For `block`, `load` is the "face set" pose.

| Shot | anticipation | load | breakdown | contact | follow | settle | ready | min T_f |
|---|---|---|---|---|---|---|---|---|
| serve | −0.70 | −0.30 | −0.12 | 0 | +0.30 | +0.55 | +0.90 | 0.22 |
| drive (FH or 2H BH) | −0.50 | −0.24 | −0.09 | 0 | +0.22 | +0.45 | +0.75 | 0.18 |
| dink | — | −0.20 | −0.08 | 0 | +0.20 | +0.38 | +0.60 | 0.14 |
| drop | −0.45 | −0.30 | −0.12 | 0 | +0.26 | +0.50 | +0.80 | 0.18 |
| lob | — (dink disguise) | −0.22 | −0.09 | 0 | +0.30 | +0.55 | +0.85 | 0.16 |
| volley | — | −0.12 | −0.05 | 0 | +0.12 | +0.28 | +0.45 | 0.08 |
| smash | −0.90 (drop step) | −0.40 (trophy) | −0.12 (paddle drop) | 0 | +0.25 | +0.50 | +0.85 | 0.25 |
| block | — | −0.07 (face set) | — | 0 | +0.05 | +0.22 | +0.40 | 0.05 |
| punch | — | −0.10 | −0.04 | 0 | +0.08 (hold to +0.23) | +0.38 | +0.55 | 0.07 |
| reset | — | −0.10 | −0.04 | 0 | +0.15 | +0.35 | +0.55 | 0.08 |
| speedup | −0.35 (dink-like set) | −0.14 | −0.05 | 0 | +0.16 | +0.36 | +0.60 | 0.10 |
| roll | — | −0.16 | −0.06 | 0 | +0.18 | +0.38 | +0.60 | 0.12 |
| flick | — | −0.12 (wrist set, may be held from the dink) | −0.04 | 0 | +0.12 | +0.30 | +0.50 | 0.06 |
| atp | run −0.8 … −0.3 | −0.22 | −0.08 | 0 | +0.20 | +0.40 | +0.40 … +1.2 (recovery run) | 0.14 |
| erne | close-leg step −0.45, push or jump −0.25 | −0.14 | −0.05 | 0 | +0.10 (land ≈ +0.12) | +0.40 | +0.70 | 0.08 |

All times are **[est]**, anchored on these:
- Tennis forward swing of 0.32 s [33a].
- Tennis volley pushing time of 0.249 s and stroke time of 0.466 s [33b].
- "Short backswing" and "6–12 in travel" coaching cues [1][14][24a].
- The video's punch hold of 0.15 s.
- The current `stroke-motion.ts` values: serve prep 0.48 / follow 0.30 / recover 0.75, dink 0.25 / 0.20 / 0.60.

### E2. Per-pose numbers

Hand positions are [x fwd, y side, z up] in metres, in the body frame defined in the Conventions section. FH = forehand,
BH = backhand.

| Shot | load hand | contact hand | follow hand | face open° (contact) | head pitch° (load → contact → follow) | chest / pelvis coil° at load | knee° load → contact | weight on front foot % (load → contact) | Off arm at load → contact |
|---|---|---|---|---|---|---|---|---|---|
| serve | [−0.45, 0.30, 0.55] | [0.55, 0.28, 0.55] (≤ navel) | [0.35, 0.05, 1.60] | +10…+20 | −50 → −30 → +40 (head stays below the wrist up to contact) | 35 / 25 | 30 → 20 | 35 → 70 | Holds the ball in front at waist → released, out for balance |
| drive FH | [−0.35, 0.60, 0.95] | [0.40, 0.60, 0.85] | [0.10, −0.20, 1.50] | −5…+5 | −10 → 0 → +60 | 70 / 45 | 35 → 25 | 35 → 70 | Points at the ball → folds across the chest |
| drive 2H BH | [−0.30, −0.55, 0.85] | [0.45, −0.45, 0.85] | [0.20, 0.25, 1.30] | −5…+5 | −10 → 0 → +45 | 80 (dominant shoulder at the chin) / 50 | 35 → 25 | 35 → 70 | On the handle and driving |
| dink | [0.35, 0.40, 0.40] | [0.50, 0.40, 0.35] | [0.70, 0.35, 0.65] | +35…+45 (deep), +10…+20 (high) | −45 → −40 → −10 | 15 / 10 | 50 → 55 | 50 → 60 | In front near the throat |
| drop | [−0.20, 0.55, 0.55] | [0.30, 0.55, 0.50] | [0.55, 0.40, 1.00] | +20…+30 | −30 → −20 → +20 | 35 / 25 | 40 → 40 | 40 → 65 | Forward, balancing |
| lob | [0.30, 0.45, 0.45] (dink disguise) | [0.40, 0.45, 0.45] | [0.40, 0.25, 1.75] | +45…+60 | −30 → −10 → +70 (points at the sky) | 15 / 10 | 45 → 40 | 50 → 60 | In front |
| volley | [0.25, 0.45, 1.15] | [0.50, 0.40, 1.15] | [0.70, 0.30, 1.10] | 0…+10 | +40 → +30 → +25 | 20 / 10 | 25 → 25 | 50 → 55 | In front, ≥ 0.25 m from the chest |
| punch | [0.25, 0.40, 1.15] | [0.50, 0.40, 1.10] | [0.70, 0.35, 1.05] (held) | −5…+5 | +40 → +30 → +25 | 20 / 10 | 25 → 25 | 50 → 60 | In front |
| block | [0.35, ±0.20, 1.05] | [0.40, ±0.20, 1.00] | [0.42, ±0.20, 1.00] | +10…+20 | +30 → +30 → +30 | 10 / 5 | 30 → 30 | 50 → 50 | In front (BH: near the throat) |
| reset | [0.15, 0.40, 0.45] | [0.40, 0.40, 0.35] | [0.50, 0.38, 0.55] | +20…+35 | −40 → −40 → −20 | 15 / 10 | 60 → 65 | 50 → 55 | Low, in front |
| speedup FH | [0.20, 0.50, 0.70] | [0.55, 0.50, 0.80] | [0.65, 0.20, 1.35] | −5…+5 (upward brush) | −20 → +5 → +40. Wrist extended 30–45° at load. | 25 / 15 | 40 → 30 | 50 → 65 | In front → pulls back |
| roll FH | [0.30, 0.45, 0.55] | [0.55, 0.42, 0.65] | [0.55, 0.20, 1.40] (toward the ear) | 0…+15 | −60 → −20 → +50 | 20 / 10 | 45 → 40 | 50 → 65 | In front |
| flick BH | [0.30, −0.25, 0.75] (elbow up at ≈ 1.05) | [0.55, −0.20, 0.80] | [0.70, −0.10, 1.15] | 0…+10 | −60 → 0 → +30. Wrist fully extended at load → neutral at contact. | 30 (BH side) / 15 | 45 → 40 | 50 → 60 | Off hand near the throat, then releases |
| atp FH | [−0.25, 0.70, 0.45] | [0.20, 0.70, 0.35] | [0.40, 0.45, 0.90] | +10…+20 | −30 → −20 → +20 | 40 / 25 (open stance) | 55 → 55 | 70 % on the outside leg | Out wide for balance |
| erne (FH or BH volley) | [0.30, ±0.40, 1.10] | [0.45, ±0.35, 1.05] | [0.60, ±0.30, 0.95] | −5…+5 | +30 → +20 → +10 | Hips square to the net [31a] | 30 → 25 (or airborne) | Close leg leads | Out for balance |
| smash | [−0.15, 0.25, 1.65] (trophy: elbow ≈ 1.60, paddle cocked behind the head) | [0.35, 0.20, 2.10] (in front of the hitting shoulder) | [0.35, −0.30, 0.85] (opposite hip) | −5…−15 (downward) | +120 (tip up and back) → +80 → −60 | 85 (side-on) / 70 | 25 → 10 | 35 → 70 | Straight up, pointing at the ball → tucks to the chest |

Sources for E2:
- Serve, dink, volley, punch and smash contact numbers come from `video-guide.md` and A1/A3/A6/A8.
- The serve contact limit is from [10]. Dink contact is from [2][3]. The volley elbow is from [24a]. Smash contact and
  follow are from [25a]. The 2H BH is from [17][19][21]. The lob finish is from [23a]. The flick setup is from
  [28a][28b]. The roll dip and brush are from [29b][4]. ATP stance and height are from [30c]. The Erne hips are
  from [31a].
- The coil, knee, weight and pitch values are **[est]**, scaled from [33a] and the qualitative cues.

### E3. Constraint checklist per shot (for tests)

- **serve:**
  - contact z ≤ navel (≈ 1.0 m)
  - paddle tip z < wrist z at contact
  - hand velocity z > 0 at contact
  - follow hand z ≥ 1.5 m [10]
- **lob:** follow head pitch ≥ +50° and hand z ≥ head height [23a].
- **dink, reset, block:** pelvis height at contact ≤ pelvis height at load + 0.02 m (no rising) [26a][1].
- **smash:**
  - off hand above the head at `load`
  - contact x > hitting-shoulder x (in front)
  - follow hand on the non-dominant side [25a]
- **erne:**
  - feet outside the NVZ at contact and landing
  - first step uses the leg nearest the post [31a][31b]
- **atp:** body outside the sideline at contact, and contact after the ball passes the post plane [30a][30b].
- **All shots:**
  - contact x > pelvis x (in front of the hip) [16][24a]
  - clearance per B
  - hand lags pelvis on the forward swing (C4)
  - hand path non-collinear (C5)

---

## References

### Pickleball

- [1] Primetime Pickleball, *5 keys to successful dinking*. https://primetimepickleball.com/5-keys-to-successful-dinking/
- [2] The Dink, *How to dink consistently*. https://www.thedinkpickleball.com/how-to-dink-consistently-in-pickleball/ (also
  https://www.thedinkpickleball.com/pickleball-dinking-technique-the-complete-beginners-guide/)
- [3] MyPickleballConnect, *Dink rally coach meta-analysis*. https://mypickleballconnect.com/takes/dink-rally/
- [4] The Dink, *7 topspin dink keys*. https://www.thedinkpickleball.com/7-topspin-dink-keys-that-turn-a-soft-shot-into-a-weapon/
- [5] Selkirk, *The best ready position for pickleball*. https://www.selkirk.com/blogs/pickleball-education/the-best-ready-position-for-pickleball
- [6] The Pickler, ready position. https://thepickler.com/?p=8
- [7] Pickleball Union, ready position. https://pickleballunion.com/?p=63504
- [8] USA Pickleball, *The split step*. https://usapickleball.org/training-tips-category/the-one-footwork-step-every-player-needs-to-know-the-split-step/page/6
- [9] Split-step guides: https://www.mypickleballconnect.com/iq/split-step/ and https://engagepickleball.com/blogs/tips/what-is-the-split-step
- [10] MyPickleballConnect, *Serve rules 2026* (USAP Rule 4.A). https://mypickleballconnect.com/guides/pickleball-serve-rules-2026/
- [11] The Dink, *Serve footwork, stance, load, weight transfer*. https://www.thedinkpickleball.com/pickleball-serve-footwork-stance-load-weight-transfer/
- [12] Pickleball Union, serve weight transfer. https://pickleballunion.com/?p=64374
- [13] Olaben, *Pickleball serving techniques*. https://olaben.com/blogs/olaben-blog/pickleball-serving-techniques
- [14] Pickleball.com, *How to build a reliable forehand drive*. https://pickleball.com/learn/how-to-build-a-reliable-forehand-drive-in-pickleball
- [15] The Dink, *Effortless power through proper body rotation*. https://www.thedinkpickleball.com/generate-effortless-power-in-pickleball-through-proper-body-rotation/
- [16] Pickleball Union, *Stop hitting forehand drives long*. https://pickleballunion.com/stop-hitting-forehand-drives-long/
- [17] The Kitchen Pickle, *Two-handed backhand tips*. https://thekitchenpickle.com/blogs/tips/two-handed-backhand-pickleball-tips/
- [18] Selkirk, *When to use your two-handed backhand* (Catherine Parenteau). https://www.selkirk.com/blogs/educational/when-to-use-your-two-handed-backhand-on-the-pickleball-court-tips-from-pro-catherine-parenteau-on-selkirk-tv
- [19] Pickleball Union, *Backhand return of serve*. https://pickleballunion.com/backhand-return-of-serve-in-pickleball/
- [20] The Dink, *Two-handed backhand drive: when, how, why*. https://www.thedinkpickleball.com/when-how-why-to-hit-a-two-handed-backhand-drive-in-pickleball/
- [21] SportsEdTV, *Two-handed backhand counter-attack*. https://sportsedtv.com/blog/the-two-handed-backhand-counter-attack-in-pickleball
- [22a] SportsEdTV, *Ultimate third shot drop technique*. https://sportsedtv.com/blog/the-ultimate-third-shot-drop-technique-unlocking-success-on-the-pickleball-court
- [22b] UTR Sports, *Master the third shot drop*. https://www.utrsports.net/blogs/news/master-the-third-shot-drop-in-pickleball-technique-drills
- [22c] Engage Pickleball, *Practicing third-shot drops*. https://engagepickleball.com/blogs/tips/comprehensive-guide-to-practicing-third-shot-drops-in-pickleball-strategy-and-drills
- [23a] The Dink, *Lob: 5 keys to disguise it*. https://www.thedinkpickleball.com/pickleball-lob-5-keys-to-disguise-it-and-win-more-points/
- [23b] Pickleball.com, *How to hit a pickleball lob*. https://pickleball.com/docs/en/article/how-to-hit-a-pickleball-lob (also Selkirk offensive lob:
  https://www.selkirk.com/blogs/pickleball-education/how-the-offensive-lob-can-earn-you-more-pickleball-points-tips-from-pro-catherine-parenteau)
- [24a] MyPickleballConnect, *Volley fundamentals*. https://www.mypickleballconnect.com/guides/pickleball-volley-fundamentals/ (also
  https://www.thedinkpickleball.com/5-pickleball-volley-fixes-for-the-kitchen-line/ and
  https://forwrd.co/blogs/strategy-tips/how-to-volley-in-pickleball-the-mechanics-that-actually-win-points-2026)
- [24b] MyPickleballConnect, *Backhand punch*. https://mypickleballconnect.com/guides/pickleball-backhand-punch/ (also
  https://pickleballunion.com/how-to-hit-pickleball-punch-volley-winner/)
- [25a] The Dink, *Overhead smash: complete guide*. https://www.thedinkpickleball.com/overhead-smash-pickleball-technique-the-complete-guide/
- [25b] USA Pickleball, *Keys to hitting an overhead slam*. https://usapickleball.org/pickleball-training-tips/how-to-recover-a-lob-that-goes-over-your-head-and-keys-to-hitting-an-overhead-slam/page/2
- [25c] Pickleball Union, *Overhead smash technique*. https://pickleballunion.com/pickleball-overhead-smash-technique/
- [26a] The Dink, *Block volley fixes that stop bangers*. https://www.thedinkpickleball.com/block-volley-fixes-that-stop-bangers-in-pickleball/ (also
  https://engagepickleball.com/blogs/tips/block-shot-what-when-why-and-how)
- [26b] Selkirk, *Block volley* (Parenteau). https://labs.selkirk.com/blogs/pickleball-education/why-you-should-use-the-pickleball-block-volley-and-how-to-do-it-tips-from-pro-catherine-parenteau
- [27a] Pickleball.com, *How to reset*. https://pickleball.com/docs/en/article/how-to-reset-in-pickleball.html
- [27b] Engage Pickleball, *How to execute a reset*. https://engagepickleball.com/blogs/tips/how-to-execute-a-reset-in-pickleball
- [27c] Pickleball Union, *Collin Johns mid-court reset*. https://pickleballunion.com/collin-johns-mid-court-reset/
- [27d] MyPickleballConnect, *Reset shot* (animated). https://www.mypickleballconnect.com/iq/reset-shot/
- [28a] Pickleball Union, *Backhand poke vs roll vs flick*. https://pickleballunion.com/backhand-poke-vs-roll-vs-flick/
- [28b] USA Pickleball, *How to hit a backhand flick volley*. https://usapickleball.org/pickleball-skills/level-three/how-to-hit-a-backhand-flick-volley/
- [28c] The Dink, *Set and snap technique*. https://www.thedinkpickleball.com/effortlessly-destroy-your-flicks-and-speed-ups-the-set-and-snap-technique/
- [28d] PlayPickleball, *6 deceptive shots*. https://www.playpickleball.com/6-deceptive-pickleball-shots/
- [29a] Pickleball360, *Ben Johns backhand roll volley dink* (transcript). https://pickleball360.com/transcripts/day-01/transcript-backhand-roll-volley-dink
- [29b] The Dink, *Roll volley vs punch volley*. https://www.thedinkpickleball.com/roll-volley-vs-punch-volley-which-pickleball-shot-to-hit/
- [29c] Topspin brush, angle and path: https://www.thedinkpickleball.com/topspin-pickleball-technique-brush-angle-paddle-path/ and https://pickleballunion.com/how-to-hit-a-topspin-forehand-volley/
- [30a] Pickleball.com, *Mastering the ATP*. https://pickleball.com/learn/mastering-the-atp-in-pickleball-timing-footwork-and-smart-execution
- [30b] The Dink, *ATP guide*. https://www.thedinkpickleball.com/how-to-hit-an-atp-in-pickleball-around-the-post-guide/ (also https://pickleballunion.com/pickleball-atp-shot-mistakes/)
- [30c] The Pickler, *ATP tips*. https://thepickler.com/pickleball-blog/pickleball-atp-tips
- [31a] The Dink, *How to hit the Erne without foot faulting*. https://www.thedinkpickleball.com/how-to-hit-the-erne-in-pickleball-without-foot-faulting/
- [31b] Primetime Pickleball, *3 ways to hit a legal Erne*. https://primetimepickleball.com/3-ways-to-hit-a-legal-erne-in-pickleball/
- [31c] The Pickler, *Master the Erne*. https://thepickler.com/pickleball-blog/pickleball-tips-master-erne
- [32a] The Dink, *Chicken wing problem*. https://www.thedinkpickleball.com/how-to-fix-the-chicken-wing-problem-in-pickleball/
- [32b] Pickleball Union, *Stop getting chicken-winged*. https://pickleballunion.com/how-to-stop-getting-chicken-winged/

### Tennis and biomechanics analogues

- [33a] Landlinger et al. 2010, *Key factors and timing patterns in the tennis forehand of different skill levels*, JSSM 9(4). https://pmc.ncbi.nlm.nih.gov/articles/PMC3761808
- [33b] Chao et al. 2008, *Kinematic analysis of tennis volley*, ISBS. https://ojs.ub.uni-konstanz.de/cpa/article/view/1922
- [33c] Tennishead, *Use your non-hitting arm to create space*. https://tennishead.net/use-your-non-hitting-arm-to-create-space-on-your-forehand/
- [33d] Tennis.com, *One minute clinic: active non-dominant arm*. https://prod.tennis.com/news/articles/one-minute-clinic-active-non-dominant-arm (also https://playyourcourt.com/news/?p=9778)
- [33e] *Biomechanics and tennis* (review, Elliott). https://web.as.uky.edu/biology/faculty/cooper/Physics%20in%20sports-movement%20and%20health/Biomechanics%20and%20tennis.pdf
- [33f] Proximal-to-distal sequencing in handball throwing. https://lida.sport-iat.de/ta/Record/4016823?lng=en
- [33g] Furuya & Kinoshita, proximal-to-distal sequencing in expert keystrokes. https://dumas.ccsd.cnrs.fr/UNIV-RENNES1/hal-03324360v1
- [33h] TennisOne (Saviano), volley technique. https://tennisone.tennisplayer.net/club/lessons/saviano/tech3/part3.php (also
  https://www.sportplan.net/drills/Tennis/Volley-Drills/No-Late-Volleys-MarcMay22_03.jsp)
- [33i] Tennis.com, *Ask Nick: forehand extension*. https://tennis.com/news/articles/ask-nick-tips-for-forehand-extension
- [33j] TennisPlayer, *1-2 rhythm forehand*. https://tennisplayer.net/members/classiclessons/nick_wheatley/1-2_rhythm_forehand

### Animation

- [40] *Twelve basic principles of animation* (Thomas & Johnston, *The Illusion of Life*). https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- [41] *Animator's Survival Kit* timing and spacing summaries. https://blogs.ulster.ac.uk/scottmoore/2023/11/12/animation-studio-workshops-week-7 and https://drishtikosambia.myblog.arts.ac.uk/?p=202
- [42] Pose-to-pose mixed with straight-ahead for pitching and batting, and anticipation length. https://brianlemay.com/Pages/animationschool/animation/2ndsemesteranimation/07assignment.html and https://www.dgp.toronto.edu/~patrick/csc418/notes/tutorial11.pdf
- [43] Jonathan Cooper, Game Anim: anticipation, apex, recoil. https://www.gameanim.com/?p=115
- [44] Daniel Holden, *Spring-It-On: The Game Developer's Spring-Roll-Call*. https://theorangeduck.com/page/spring-roll-call
- [45] Easing functions cheat sheet. https://easings.net/
- [46] HackMotion, *Lag in the golf swing* (club-head lag behind the hands). https://hackmotion.com/lag
- [47] 12 principles explained: follow through, overlap, drag, arcs, secondary action. https://www.animaker.com/hub/?p=7967 and https://www.simonwhatley.co.uk/writing/disney-12-basic-principles-of-animation/
- [48a] Animator Island, *Defining the art: twinning*. https://www.animatorisland.com/defining-the-art-twinning/
- [48b] Animation Mentor, twinning. https://www.animationmentor.com/?p=4836
- [49a] David Rosen, GDC 2014 *Animation Bootcamp: An Indie Approach to Procedural Animation* (Overgrowth). https://www.gdcvault.com/play/1020583/ and https://gamedeveloper.com/design/video-an-indie-approach-to-procedural-animation
- [49b] Discussion of the talk (keyed poses plus springs). https://polycount.com/discussion/comment/2093086 and https://discussions.unity.com/t/an-indie-approach-to-procedural-animation-gdc-video-talk/538228
- [50] David Bollo, *Inertialization: High-Performance Animation Transitions in Gears of War* (GDC 2018). https://gdcvault.com/play/1025165/Inertialization-High-Performance-Animation-Transitions and https://history.siggraph.org/wp-content/uploads/2022/09/2017-Talks-Bollo_High-Performance-Animation-in-Gears-of-War-4.pdf
- [51] Xbox Wire / Hangar 13, *Signature gameplay animations for TopSpin 2K25*. https://news.xbox.com/en-us/2024/04/03/signature-gameplay-animations-for-topspin-2k25/
- [52] GameDev.net, *How to avoid ball mishits* (tennis swing blending, contact tagging, IK). https://gamedev.net/forums/topic/701222-tech-challenge-how-to-avoid-ball-mishits-unity
- [53a] Unreal Control Rig TwoBoneIK. https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/RigUnit_TwoBoneIKSimpleVectors
- [53b] Godot TwoBoneIK3D (pole target defines the elbow plane). https://remotebranch.eu/Stowage/godot/src/branch/master/doc/classes/TwoBoneIK3D.xml
- [54a] Epic, *Fix foot sliding with IK Retargeter*. https://dev.epicgames.com/documentation/en-us/unreal-engine/fix-foot-sliding-with-ik-retargeter-in-unreal-engine
- [54b] Bugnet, *How to fix animation foot sliding*. https://bugnet.io/blog/how-to-fix-animation-foot-sliding
- [54c] Glardon, Boulic & Thalmann 2006, robust footplant detection. https://infoscience.epfl.ch/record/99030
- [55] Simon Clavet, *Motion Matching and The Road to Next-Gen Animation* (GDC 2016). https://gdcvault.com/play/1023280/Motion-Matching-and-The-Road

### Rules and anthropometry

- [60] 2025 USA Pickleball Rules §2 (court, net, paddle). https://www.playpickleball.com/2025-usa-pickleball-rules-section-2-court-and-equipment/
- [62] Drillis & Contini segment ratios as cited in Winter, with validation and caveats. https://ojs.ub.uni-konstanz.de/cpa/article/view/292
