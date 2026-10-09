# Tennis frame-by-frame reference → pickleball key timing at 24 fps

Written 2026-10-09 from web research. It adds to `technique-research.md` (per-shot technique, the 12 principles, the
E1/E2 tables), `animation-principles.md` (architecture) and `video-guide.md` (measured pickleball poses). Those files
are not repeated here.

**Tags.** `[Tn]` maps to a URL in the References at the end. **[est]** marks an engineering estimate derived from the
cited numbers. **[calc]** marks arithmetic done for this file, such as unit conversion, frame conversion or curve
analysis. The cubic-bézier properties in §3 were computed numerically, not copied.

**Conventions.**
- 24 fps, so **1 f = 41.7 ms**. Frames are relative to contact (frame 0), and negative means before contact.
  Fractional frames are fine: evaluate in continuous time, using t = f / 24 s.
- Right-handed player. Keys follow the app's scheme: `R` = leave ready, `A` = anticipation, `L` = load (backswing
  extreme of the hand), `B` = breakdown (forward-swing passing pose), `C` = contact, `F` = follow extreme,
  `S` = settle (overshoot), `R'` = back in ready.
- "Peak" means the frame of peak angular velocity (body) or peak linear speed (hand and paddle). "Reversal" means the
  frame where a channel changes direction, which is its own load extreme.

---

## 0. TL;DR

- **Real strokes are fast.** The tennis hand-forward phase (hand farthest back → contact) is **0.11–0.17 s
  (2.6–4 f)**: Nadal 0.11 s [T5], Ruusuvuori 0.16 s [T6], return forehand 0.16–0.17 s [T13]. A tennis volley's
  forward swing is 0.12–0.165 s (3–4 f) [T11]. Even the serve's racket-drop-to-contact burst is about 0.1 s (2.4 f)
  [T19].
- **Slow-down bug, in frames.** A 5–9× slowdown turns a 5 f pickleball drive swing into 25–45 f (1.0–1.9 s). That is
  slower than a whole tennis forehand from shoulder turn to contact, which takes 0.73 s [T5]. Never scale key times;
  only a debug playback clock may slow things down (§6).
- **What is slow in tennis is the preparation, not the swing.** Nadal's backswing takes 0.62 s and the swing 0.11 s
  [T5]. On the return, the backswing takes 0.51 s and the forward swing 0.16 s [T13]. For pickleball, shorten the
  takeback (×0.4–0.6) and the follow (×0.6–0.7). Keep the forward swing at **2–5 f**.
- **Speed peaks at contact.** The racket-head peak falls about 2 ms before impact [T1]. Earlier "peak before impact"
  findings were filtering artifacts [T22][T23]. Proximal segments peak earlier and are already slowing at contact:
  - Pelvis −75 ms (−1.8 f)
  - Trunk −57 ms (−1.4 f)
  - Maximum wrist lag −55 ms (−1.3 f)
  - Shoulder, elbow and wrist linear speeds −45, −39 and −37 ms (about −1 f)
  - Shoulder internal rotation (forearm roll) **after** contact, at +24 ms (+0.6 f) [T1]
- **Ordering at the load.** The pelvis reverses first, at −243 ms (−5.8 f). The hand and chest load next, together
  with the maximum X-factor, at −168 ms (−4 f). The racket head lags behind them at −146 ms (−3.5 f) [T1].
- **Easing.**
  - Forward swing: a power curve with normalized contact tangent m = 2.0–2.4, for example `cubic-bezier(0.50, 0.05, 0.75, 0.40)`.
  - Follow: m = 2–3 down to 0, for example `cubic-bezier(0.25, 0.60, 0.50, 1.00)`.
  - Body yaw channels use their own in-out curves that peak at 40–45 %, timed so the peaks land at the frames above.
  - Settle needs **two** segments or a spring. `easeOutBack` from rest has a start slope of 4.6–5.1, which shows up as
    a visible velocity kick.
- **Final pickleball durations** (R → R', §4.3):

  | Shot | Duration |
  |---|---|
  | serve | 30 f, 1.25 s |
  | drive | 28 f, 1.17 s |
  | dink | 20 f, 0.83 s |
  | volley | 17 f, 0.71 s |
  | punch | 17 f, 0.71 s |
  | block | 15 f, 0.63 s |
  | smash | 34 f, 1.42 s |
  | speedup | 22 f, 0.92 s |
  | flick | 17 f, 0.71 s |

---

## 1. Tennis stroke phase models (measured)

### 1.1 Forehand (open or semi-open stance)

**Phases.** Unit turn and backswing → forward swing (drop or lag, then acceleration) → contact → follow-through (wrap)
→ recovery. Two different "forward swing" definitions are in use:
- Landlinger's **324 ms** forward swing (elite) [T1] starts at the top of the racket loop, so it includes the drop.
- The **hand-forward** phase, measured from the hand's farthest-back point, is **0.11–0.17 s** [T5][T6][T13].

Pickleball backswings have almost no loop, so the **hand-forward** number is the one to transfer.

**Measured timings (ms relative to contact).**

| Event | Elite | High-performance | Source |
|---|---|---|---|
| Forward-swing start (top of the loop) | −324 ± 86 | −326 ± 64 | [T1] |
| Maximum hip (pelvis) coil, followed by pelvis reversal | −243 ± 68 | −236 ± 39 | [T1] |
| Maximum hip–shoulder separation (X-factor) | −168 ± 77 | −148 ± 19 | [T1] |
| Maximum racket rotation (racket head farthest back, lag) | −146 ± 42 | −133 ± 42 | [T1] |
| Pelvis peak angular velocity | −75 ± 8 | −93 ± 12 | [T1] |
| Trunk peak angular velocity | −57 ± 4 | −75 ± 11 | [T1] |
| Maximum wrist extension (lag) | −55 ± 11 | −56 ± 12 | [T1] |
| Shoulder / elbow / wrist peak linear velocity | −45 / −39 / −37 | −60 / −40 / −40 | [T1] |
| Peak horizontal racket-head velocity | ≈ −2 (that is, at contact) | ≈ −3 | [T1] (see also `technique-research.md` A0) |
| Shoulder internal-rotation peak | +24 ± 11 | +24 ± 13 | [T1] |

**Other timings.**
- Nadal, 50 Hz match video: 0.73 s from shoulder turn to contact, split into 0.62 s backswing and 0.11 s from the end
  of the backswing to contact. Semi-open stance [T5].
- Ruusuvuori, a junior: hand farthest back → contact took 0.16 s, the follow-through 0.30 s, and the whole stroke
  0.88 s. The source gives 0.38 s as the follow for "excellent athletes" [T6].
- Return forehand: the backswing takes 0.51–0.56 s and the forward swing 0.16–0.17 s [T13].

**Joint angles at key events.**
- **Knees.**
  - Ruusuvuori's loading (right) knee measured 111.8° included (about 68° of flexion [calc]) at the end of
    preparation and 162.2° (about 18° of flexion) at contact. That is the leg drive [T6].
  - Nadal's knees measured 132.3° and 141.8° included (about 48° and 38° of flexion) at the end of the
    backswing [T5].
- **Hip–shoulder separation.**
  - Maximum 27° (elite) and 33° (high-performance) [T1].
  - Nadal: −38.8° at the end of the backswing → +8.6° at contact [T5].
  - Ruusuvuori: −38.4° when the hand is farthest back [T6].
- **Elbow at contact.**
  - Double-bend style: Ruusuvuori 118° at contact, flexing to 68° at the end of the follow [T6].
  - In ATP players the elbow moves toward full extension just before contact [T7]. This is the straight-arm style.
- **Wrist lag.** Maximum wrist extension of 85–89° at about −55 ms [T1].
- **Racket-head speed.** 31–33 m/s peak [T1]. Junior: 23 m/s at contact [T6].
- **Hand and wrist speed at contact (the useful sanity range for our IK hand).**
  - Nadal: hand 7.5 m/s, wrist 6.3 m/s [T5].
  - Ruusuvuori: wrist 8.0 m/s [T6].

**Racket-speed profile.** Speed rises monotonically to contact and peaks *at* contact [T1]. Studies that smoothed
data "through impact" produced spurious drops in speed before contact, and those drops were wrongly read as a skill
feature [T22][T23]. Drivers of racket speed are pelvis and trunk axial rotation, shoulder horizontal adduction and
shoulder internal rotation [T8].

### 1.2 Two-handed backhand (2HBH)

**Rotation angles.**
- Shoulder turn at the end of the backswing: 79.5–87.2° for the 2HBH, against 117–121° for the 1HBH. Hips: 58–69°
  (2H) against 88–90° (1H) [T9, table 1, Reid & Elliott 2002].
- Rotation during the acceleration phase: hips 47–59° and shoulders 71–85° for the 2HBH, against 19–33° and 30–59°
  for the 1HBH [T9][T10].

**Separation at contact.** −6.5 ± 4.3° for the 2HBH and +9.3 ± 7.3° for the 1HBH [T10]. The trunk rotation
contributes about 2× more handle speed in the 2HBH (2.09 against 0.94 m/s) [T10].

**Pelvis angular velocity.** 538 °/s (2H) against 281 °/s (1H) [T9].

**Swing time.** About 0.4–0.5 s, depending on the definition. The review prints the 1H/2H order inconsistently [T9].

**Sequence, as % of the acceleration phase** (peak linear velocity, dominant side) [T10]:

| Segment | 2HBH | 1HBH |
|---|---|---|
| Hip | 24 % | 8 % |
| Shoulder | 55 % | 50 % |
| Elbow | 76 % | 70 % |
| Wrist | 87 % | 82 % |

On the 2HBH, the **non-dominant** shoulder, elbow and wrist peak at 96–100 %, essentially at contact. The second arm
is the late "push". The non-dominant wrist speed is 6.85 m/s [T10].

**Frames [est].** Take an acceleration phase of 4 f, by analogy with the forehand hand-forward phase:
- Hip −3 f, shoulder −1.8 f, elbow −1 f, lead wrist −0.5 f.
- Trail (non-dominant) hand about 0 f.

### 1.3 One-handed backhand slice

**Path and face.**
- Path about 15° downward with the face slightly open (Machar Reid, Tennis Australia) [T14].
- Backspin approach shots: the racket path is about 19° down (0.34 rad) with the face tilted back about 6°
  (0.11 rad). Peak racket speed is 16.6 m/s, against 26.5 m/s for topspin [T15]. The slice is a **slower, longer
  carry**.

**Joints.**
- Shoulders turned about 130° at the end of the backswing (Elliott & Christmas 1995) [T9].
- Elbow about 170° at impact, nearly straight but not locked [T9].
- Elbow extension supplies about 25 % of racket speed, and trunk rotation plus upper-arm movement about 15 % [T9].
- The 1H pattern peaks earlier in the chain than the 2H (§1.2) [T9][T10].
- Hips rotate only 19–33° in the acceleration phase [T9]. The body stays closed, and the off arm swings back for
  balance.

**Frames [est].**
- Takeback is high (racket above the hand): L at −6 f.
- Descending breakdown: B at −3 f.
- C at 0.
- Long extension toward the target: F at +8 f.
- Use a softer power curve, m_in about 1.8 (§3).

### 1.4 Volley (forehand and backhand)

**Chao et al. 2008** (15 players, 250 Hz, ball 21 m/s) [T11]:

| Phase | Duration |
|---|---|
| Split-step (toes off → toes on) | 0.31–0.36 s |
| Ipsilateral side step | 0.12–0.27 s |
| Forward swing | **0.121–0.165 s** |
| Stroke (first racket movement → impact) | 0.47–0.62 s |
| All phases | 1.04–1.15 s |

At impact:
- Elbow 132–160°, with the most bent at the middle location.
- Wrist 157–162°.
- Shoulder 52–101°.
- Peak wrist speed in the forward swing 4.3–5.1 m/s.

**Chow et al. 1999** [T12]:
- Reaction (ball release → first racket movement): 226 ms forehand, 205 ms backhand.
- Stroke (first racket movement → impact): **381 ms** for fast balls up to 803 ms for slow balls.
- 75 % of trials showed a distinct forward racket motion just before contact.

**Coordination.** The upper limb and racket tend to move **as a single unit**, with small amounts at the shoulder,
elbow and wrist (Elliott 1988, cited in [T11]). There is no X-factor and no lag.

### 1.5 Serve (reference only — see §4.4 for what transfers)

**Phases.** 3 phases and 8 stages [T2]:
- Preparation: start, release, loading, cocking.
- Acceleration: acceleration, contact.
- Follow-through: deceleration, finish.

**Durations.**
- The whole motion takes **more than 2 s**. Racket drop → contact is about **0.1 s**, and the racket gains about two
  thirds of its speed in it. This is Sampras at 200 fps [T19].
- Federer's upward swing takes about 0.1 s [T20].
- The toss leaves the hand about 1.1 s (Sharapova) or 0.7 s (Isner) before contact [T21].

**Timing (ms before contact)** [T2]:
- Lead-knee peak extension velocity: −180 ± 65 ms (−4.3 f).
- Maximum shoulder external rotation (ER): −90 ± 14 ms (−2.2 f).
- Upper-torso peak: −58 ms (men) to −75 ms (women) (−1.4 to −1.8 f).
- One skilled server had the wrist extended at −100 ms, then flexed it into contact [T18].

**Angles** [T2]:
- At maximum ER: abduction 101°, ER 172°, elbow flexion 104°, wrist extension 66°.
- At contact: elbow flexion 20°, wrist extension 15°, front-knee flexion 24°, trunk 48° above horizontal.
- Loading: front-knee flexion > 15° is recommended. The reported front-knee extension range from the loaded position
  is 54° (foot-up) to 66° (foot-back).

**Racket speed.** 38–47 m/s [T2].

**Legs and trunk.** They supply 51–55 % of the kinetic energy and force delivered to the hand [T2].

**Sequencing caveat.**
- Professionals are *not* strictly proximal-to-distal. In eight Dutch professionals the pelvis peaked about 28 ms
  *after* the trunk, and the upper arm peaked 124–127 ms after the trunk [T16].
- Two WTA players showed individual chains that did not follow the maximum-angular-velocity order [T17].
- Animate a clear proximal-to-distal order anyway, for readability, but do not exaggerate it.

### 1.6 Overhead smash

**No hard-court tennis smash kinematics were found.** The searches returned soft-tennis, badminton and serve
studies. The phase model borrows the serve [T2].

**Coaching consensus.**
- Turn sideways early, with a quick hip and shoulder rotation.
- Bring the racket **straight up**. There is no low loop as in the serve.
- Point at the ball with the off arm, elbow first and then finger.
- Reach a trophy-like pose. The racket drop follows, and time from the set-up to contact "can be very quick"
  (paraphrased) [T24].

**Match play.** In match play the forward swing is shorter than in the lab (soft-tennis smash) [T25].

**Frames [est].**
- Turn and drop step: A at −20 to −14 f.
- Trophy: L at −7 f, with a 1–2 f cushion.
- Racket drop: B at −2.5 f (compare with the serve's maximum ER at −2.2 f [T2]).
- C at 0.
- Finish across to the opposite hip: F at +8 f.

### 1.7 Lob

No lob-specific tennis kinematics were found.

**Proxies.**
- Topspin approach shots swing **upward** at about 27° (0.48 rad) with the face rotated 0.13 rad forward. Backspin
  swings go down 19° [T15].
- Topspin rate rises with a *more closed* face (70–85° to the ground) [T26]. An open-face lob therefore trades
  topspin for height.
- Coaching uses a slightly open face. Leaning back to open the face telegraphs the shot [T27].

**Frames [est].** Forehand chain, but the forward swing is 1 f longer, the path steeper, and F at +9 f. The racket
finishes high, pointing up.

### 1.8 Return of serve and block

**Carboch et al. 2014** (live server at about 113 km/h) [T13]:
- Movement initiation: 0.42 s.
- **Backswing: 0.51 s.**
- **Forward swing: 0.16 s.**
- Against a ball machine the backswing is longer: 0.56 s, initiation 0.37 s.

**Mecheri et al. 2019** (ATP, WTA and ITF junior players returning fast serves) [T28]:
- First racket movement: **187 ms** after the server's contact (4.5 f).
- First foot movement: 266 ms (seniors) and 311 ms (juniors), which is 6.4–7.5 f.

**Ball flight.** Serve flight is 0.96–1.26 s at 125–100 km/h [T29]. Kleinöder's means are 0.72–1.16 s by surface,
cited in [T13].

**Block return [est].** Same timing, with a backswing of ≤ 0.2 s and a forward swing of 3–4 f. The follow is short
(+3 to +4 f).

### 1.9 Split step

**Mecheri et al. 2019, world-class returners** [T28]:
- Take-off **+9 ± 36 ms** after the server's contact.
- Landing **+152 ± 25 ms**.
- Duration 142 ms (**3.4 f**).

**Other measurements.**
- Earlier work: take-off −40 ms, landing +160 ms (200 ms). Juniors: +34 / +151 ms (117 ms) [T28].
- Lab study (Uzu et al. 2009): a split step shortened time-to-target from 868 to 764 ms. Landing about 180 ms after
  the direction signal gave quick, reliable steps [T30].
- The volley drill in [T11] measured longer airborne split steps of 0.31–0.36 s.

**Frames [est].**
- Dip (A): about −2 f before take-off.
- Airtime: 3–4 f.
- Absorb on landing: 2–3 f.
- First lateral step: 3–4 f after landing.

Pickleball's hop is 5–10 cm (`technique-research.md` A0), so use about 3 f of airtime.

### 1.10 Recovery and shuffle

**Movement shares.**
- About 70 % of tennis movement is lateral [T31]. The lateral efforts are short bursts of 3–4 m [T31].
- A figure of "80 % of shots within 2.5 m" also circulates in this literature. It was seen only in a search summary
  and not verified, so treat it as approximate. See [T31] and https://www.redalyc.org/pdf/3010/301030569004.pdf.

**Footwork choice.**
- Shuffle for balls 4–6 ft wide. Turn and run with crossovers for wider balls, then shuffle the last steps [T32].
- Recover with crossover steps while facing the opponent, and split again as the opponent hits [T33].
- Basketball rule of thumb: about two shuffles, then a crossover beyond about 4 yd [T34].

**Running forehands.** At high entry speed, players lengthen the final stride and the backswing. Women reduced their
preparatory trunk rotation by 9° [T35].

**Frames [est].**
- A shuffle step pair (push → gather) takes 5–6 f.
- A crossover step takes 6–7 f.
- The first recovery step starts at the end of the follow, +8 to +10 f for a groundstroke.

---

## 2. Animator's table for the tennis strokes (24 fps)

All values are frames relative to contact. Measured values carry their source. The rest are **[est]**, derived from
§1. "Hold" means a cushion: an ease into and out of the extreme. It is never a dead stop. Holds of 2–5 identical frames
read as mistakes, 6 f is the practical minimum for a real hold, and longer holds should be moving holds [T36].

### 2.1 Key frames

| Stroke | A (start) | L (hand load) | B (breakdown) | C | F | Recovery / ready | Holds |
|---|---|---|---|---|---|---|---|
| Forehand | −17 (shoulder turn, 0.73 s [T5]) | −4 (hand farthest back, 0.16 s [T6]; X-factor maximum −168 ms [T1]) | −2. Racket head lagging below the hand (head reversal −3.5 f [T1]). | 0 | +7 to +9 (0.30–0.38 s [T6]) | +20 to +24 [est] | Only a 1 f cushion at L. The pause must be short [`technique-research.md` 33e]. |
| 2HBH | −17 | −4 | −2 | 0 | +7 | +20 | None |
| 1H slice | −18 | −6 (high) | −3 | 0 | +8 | +22 | 1–2 f cushion at L |
| Volley | −11 (first racket movement, 0.47 s [T11]) | −3.5 (forward swing 3–4 f [T11]) | −1.5 | 0 | +3 to +4 | +12 | 0–3 f moving hold at F (punch) |
| Serve | −48 or earlier (more than 2 s [T19]). Toss release −17 to −26 [T21]. | −8 (trophy) [est] | −2.2 (maximum ER [T2]); drop → C 2.4 f [T19] | 0 | +10 to +12 [est] | — | 1–2 f cushion at the trophy |
| Smash | −20 to −14 | −7 (trophy) | −2.5 | 0 | +8 | +20 | 1–2 f cushion at the trophy |
| Lob | −17 | −5 | −2 | 0 | +9 | +22 | None |
| Return or block | Split take-off at server contact; racket starts +4.5 f after server contact [T28] | −4 (block −3) | −2 | 0 | +4 (block +3) | — | None |

### 2.2 Per-segment timing

Format is reversal / peak, in frames.

**Measured entries.**
- The whole forehand row [T1][T6].
- Serve: knee −4.3, chest peak −1.4…−1.8, wrist extended at −2.4, and B (maximum ER) at −2.2 [T2][T18].
- 2HBH: the hip → shoulder → elbow → wrist **order and phase fractions** [T10], converted to frames with an assumed
  4 f acceleration phase.

Everything else is **[est]**.

| Stroke | Pelvis (reversal / peak) | Chest (reversal / peak) | Upper arm and forearm peak | Wrist lag maximum | Paddle-head peak | Forearm roll (internal rotation) peak | Legs |
|---|---|---|---|---|---|---|---|
| Forehand | −5.8 / −1.8 | −4 / −1.4 | −1.1 / −0.9 | −1.3 | 0 | +0.6 | Loading knee extends L → C (68° → 18° flexion [T6]) |
| 2HBH | −5.5 / −3 (hip linear) | −4 / −1.8 | −1 (elbow) | −0.5 (lead wrist) | 0. The trail hand peaks at 0. | +0.3 | Same as forehand |
| 1H slice | −6.5 / −3.7 | −6 / −2 | −1.2 | none (wrist firm) | 0 | none | Little drive. Step-in front knee. |
| Volley | ≈ −3.5 / −1 (with the step) | −3.5 / −0.5 | −0.25 | none | 0 | none | Front-foot plant at −1 to 0 |
| Serve | −8 / −1.6 | −8 / −1.6 (trunk tilt and twist) | −1 | −2.4 (extended) → 0 | 0 | +0.5 | Lead-knee extension peak −4.3 |
| Smash | −7 / −2 | −7 / −1.5 | −1 | −2.5 | 0 | +0.5 | Knee drive peak −4 |

---

## 3. Easing

### 3.1 Curve library

These were computed numerically for this file. `start` and `end` are the normalized endpoint slopes: start = y1/x1
and end = (1−y2)/(1−x2) [T37]. "Peak" is the maximum slope and where it falls on the time axis. y(0.6) is the value
reached at 60 % of the time.

| ID | Use | cubic-bezier(x1, y1, x2, y2) | start | end | peak (at x) | y(0.6) |
|---|---|---|---|---|---|---|
| `inOut` | ready → anticipation, settle → ready | (0.37, 0, 0.63, 1). easeInOutSine as listed on easings.net [T38]; not re-verified this session. | 0 | 0 | 1.59 (0.50) | 0.66 |
| `takeback` | A → L for the hand and chest. Fast departure, soft arrival. | (0.30, 0, 0.30, 0.93) | 0 | 0.10 | 2.08 (0.28) | 0.82 |
| `takebackStop` | Same as `takeback`, for a 1-D channel that reverses at L | (0.30, 0, 0.30, 1.00) | 0 | 0 | ≈ 2.1 (0.28) | 0.83 |
| `swing` | L → C, power shots. Breakdown at 60 % of time = 30 % of path. | (0.50, 0.05, 0.75, 0.40) | 0.10 | **2.40** | 2.40 (1.0) | 0.30 |
| `swingSoft` | L → C, touch shots | (0.45, 0.05, 0.70, 0.40) | 0.11 | **2.00** | 2.00 (1.0) | 0.34 |
| `follow` | C → F, power shots | (0.25, 0.60, 0.50, 1.00) | **2.40** | 0 | 2.40 (0) | 0.89 |
| `followSoft` | C → F, touch shots | (0.30, 0.60, 0.55, 1.00) | **2.00** | 0 | 2.00 (0) | 0.87 |
| `pelvis` | Pelvis yaw from reversal to "open" | (0.55, 0, 0.35, 1) | 0 | 0 | 2.51 (**0.45**) | 0.78 |
| `chest` | Chest yaw from reversal to finish | (0.50, 0, 0.30, 1) | 0 | 0 | 2.55 (**0.40**) | 0.82 |
| `weight` | Centre of mass from back foot to front foot | (0.45, 0, 0.35, 1) | 0 | 0 | 2.27 (0.39) | 0.81 |
| `knee` | Leg drive (knee extension) | (0.40, 0, 0.40, 1) | 0 | 0 | 2.04 (0.39) | 0.79 |
| `roll` | Forearm roll or face closing that peaks after contact (key it at +0.5 f) | (0.60, 0.10, 0.80, 0.45) | 0.17 | 2.75 | 2.75 (1.0) | 0.28 |
| `absorb` | Block or reset "give" after contact | (0.30, 0.40, 0.50, 1.00) | 1.33 | 0 | 1.64 (0.21) | 0.84 |
| `drift` | Moving hold, over a 2–4 % displacement | (0.40, 0, 0.60, 1.00) | 0 | 0 | 1.67 (0.50) | 0.66 |
| `settleOut` | F → S, to an overshoot key 5–8 % past ready | (0.45, 0, 0.35, 1) | 0 | 0 | 2.27 (0.39) | 0.81 |

**Reference values for the classic Penner-style approximations (Ceaser set) [T39], also computed here:**

| Curve | Value | Properties |
|---|---|---|
| easeInCubic | (0.55, 0.055, 0.675, 0.19) | start 0.10, end 2.49 |
| easeOutCubic | (0.215, 0.61, 0.355, 1) | start 2.84, end 0 |
| easeInOutCubic | (0.645, 0.045, 0.355, 1) | peak 2.75 at 0.5 |
| easeOutQuad | (0.25, 0.46, 0.45, 0.94) | start 1.84, end 0.11 |
| easeOutBack | (0.175, 0.885, 0.32, 1.275) | **start 5.06**, overshoot 8.7 %, end −0.40 |

**Do not use:**
- **`easeOutBack` from a rest pose.** The easings.net version (0.34, 1.56, 0.64, 1) also starts at slope 4.59 with
  9.8 % overshoot [calc]. Both kick the velocity. A cubic bézier cannot go from rest, overshoot and return to rest:
  with y2 > 1 the end slope turns negative. Use two segments (`settleOut` → `inOut`), the existing quintic `settle()`
  in `src/core/motion-curve.ts`, or a critically damped spring [T40].
- **Ease-out *into* contact,** for example easeOutCubic over L → C. Its end slope is 0, so the paddle stops at the
  ball.
- **Linear** (0, 0, 1, 1). It puts velocity steps at every key.

### 3.2 Hermite form (this codebase already uses velocity tangents in units per second)

The normalized tangent is m = v·T/Δ, where T is the segment duration and Δ the value change. A cubic-bézier endpoint
slope and a Hermite normalized tangent describe the same thing. In practice:

- **Forward swing as a power curve, s(u) = u^p, so m_in = p.**
  - p = 2.4 for power shots: the breakdown sits at u = 0.6 with value 0.29Δ and velocity 1.17·Δ/T [calc].
  - p = 2.0 for touch shots: the breakdown is at 0.36Δ with velocity 1.20·Δ/T [calc].
  - This puts B at 60 % of the time and 30–36 % of the path, which matches `technique-research.md` C3.
- **Contact tangent.** v_C = m_in·Δ_LC/T_LC. The follow must start with the same v_C, which is C¹.
- **Pick the follow duration from v_C.** m_out = v_C·T_CF/Δ_CF must stay ≤ 3 for no overshoot (Fritsch–Carlson
  [T41]) and ≥ 1.5 for a visible deceleration. If m_out > 3, **shorten the follow time** or lengthen the follow path.
  Never lower v_C.
- **Reversal keys.** At a reversal key (L for 1-D channels) v = 0. One instant of zero velocity is not a dead hold.
  For the 3-D hand path, use a small loop, so the *speed* along the path never reaches 0 (m_L ≈ 0.1 on the arc-length
  timing curve).
- **Uniform tangents.** TCB/Kochanek–Bartels with continuity c = 0 shares one tangent per key, which gives C¹
  [T42]. With non-uniform key spacing, store tangents per second, not per segment. The `hermite(a, b, va, vb, duration, u)`
  in `motion-curve.ts` already multiplies by `duration`.

### 3.3 Which curve drives which channel, per segment

| Channel | R → A | A → L | L → C | C → F | F → S → R' |
|---|---|---|---|---|---|
| **Paddle or hand path** (arc-length timing; the spatial path is a centripetal Catmull–Rom through L, B, C, F) | `inOut` | `takeback`. Use `takebackStop` if a 1-D channel reverses. | `swing` or `swingSoft`. B is a path waypoint at 0.6 T. | `follow` or `followSoft`, with m_out from §3.2 | `settleOut` → `inOut`, or a spring with half-life 0.08–0.12 s |
| **Pelvis yaw** | `inOut` (coil) | Ends at the pelvis reversal, ≈ 1–1.5 f *before* L | `pelvis`, from its reversal to its "open" key. The peak lands at the table frame. Not keyed at C. | (included in the `pelvis` segment) | Stops 2 f before the paddle. `inOut` back. |
| **Chest yaw** | `inOut` | `takeback`, together with the paddle (unit turn) | `chest`, from its reversal (= L) to its finish key | (included) | Stops 1 f before the paddle |
| **Weight shift** (front-foot %) | `inOut`. Anticipation: small move *away* from the shot. | `weight`, toward the back foot (to 30–35 %) | `weight`, back → front (to 65–70 % by +2 f) | Ease-out holding | `inOut` |
| **Knee bend** | `inOut` dip (split-step landing) | `weight`-type deepen (+10–15°) | `knee` drive from ≈ L−1 f; peak at the table frame | Ease-out | `inOut`. Dink, reset and block **stay low** (no rising). |
| **Forearm roll / paddle face** | none | `takeback` (face opens slightly) | `roll`, keyed at **+0.5 f** for power shots. Touch shots: a constant face, no roll. | `follow` | `inOut` |
| **Off arm** | `inOut` | `takeback` (points or tracks) | `chest` (folds in), lagging the chest by 0.5 f | `follow` | `inOut` |

---

## 4. Mapping to our 15 pickleball shots

### 4.1 Why pickleball needs different scaling

**Equipment.**
- The paddle is at most 17 in (0.43 m) long [T43]. A racket is 27 in (0.69 m) by convention and at most 29 in
  [T44][T45]. The implement is ≈ 0.63× as long [calc].
- Shoulder → face-centre radius is about 0.93 m against about 1.11 m [calc]. This uses the `technique-research.md`
  0.66 m arm, a 0.27 m face offset, and a ≈ 0.45 m hand→sweet-spot distance for the racket [est].
- Swingweight: paddles are about 70–130 kg·cm², with the pivot 2 in from the butt [T46]. Rackets are about
  300–340 kg·cm², with the pivot 4 in from the butt [T47]. That is roughly 1/3, but the pivots differ.

**Ball speed.**
- Pickleball serves: about 40 mph modelled [T48]. Pros reach 59–68 mph on radar [T49]. The fastest pickleball shots
  reach about 60 mph [T50].
- An average men's professional tennis serve is about 120 mph [T50].
- Less implement speed is needed, so **the backswing shrinks**.

**Time available.**
- Tennis returns get 0.72–1.26 s of ball flight [T13][T29].
- A kitchen exchange gets about 0.25 s (`technique-research.md` D5). That forces 2–3 f swings at the net.

**Scale rule [est].**
- Takeback duration ×0.4–0.6.
- Backswing amplitude ×0.5–0.65 for drives and the serve, and ×0.2–0.4 for touch shots.
- Follow ×0.6–0.7.
- **Forward swing: keep it about the same as tennis's hand-forward phase, 2–5 f.** Do *not* copy Landlinger's
  0.32 s, which includes the loop drop.
- Keep the proximal-to-distal **order** and "peak speed at contact" unchanged.

### 4.2 Transfer table

The "×" columns compare pickleball with the tennis source. The tennis takeback is 0.5–0.62 s and the tennis follow
0.30–0.38 s (§1).

| PB shot | Borrow from tennis | Backswing amplitude × | Takeback time × | Forward swing (L → C) | Follow × | Notes |
|---|---|---|---|---|---|---|
| serve | Low forehand chain plus the serve's rhythm. §4.4 lists what not to borrow. | 0.6 | 0.4 | 5 f | 0.8 | Pendulum behind the hip (`video-guide.md`) |
| drive FH | Open or semi-open forehand (§1.1) | 0.55–0.65 | 0.5 | 5 f | 0.6 | X-factor 15–25° (tennis 27–38°) [est] |
| drive 2HBH | 2HBH (§1.2) | 0.6 (shoulders about 50° against 80–87°) | 0.5 | 5 f | 0.6 | The trail hand pushes last |
| dink | Volley "one unit" (§1.4) plus a low slice pendulum | 0.25 | — | 2.5 f | 0.6 | No rising; the lift comes from the shoulder |
| drop | Forehand chain at about 50 % effort, with a slice-like open face (§1.3) | 0.5 | 0.5 | 4.5 f | 0.7 | Soft power curve, m_in 2.0 |
| lob | Forehand or lob (§1.7), with a dink disguise | 0.4 at R, but the hand path L → C must be ≥ 0.4 m (§4.5) | — | 4 f | 0.8 | Finish pointing at the sky |
| volley | Volley (§1.4) | 0.6 (≤ 0.15–0.2 m) | 0.5 | 2.5 f (tennis 3–4 f) | 0.7 | Single unit |
| smash | Overhead (§1.6) plus the serve's acceleration (§1.5) | 0.8 | 0.5 | 6 f from the trophy; 2.5 f from the drop (as in tennis) | 0.7 | The off arm points |
| block | Block return (§1.8) and block volley | 0.2 | — | 2 f | 0.3 | Absorb |
| punch | Punch volley | 0.5 | — | 2.5 f | 0.5, plus a moving hold | |
| reset | Low block or half-volley | 0.3 | — | 2.5 f | 0.5 | Stay low |
| speedup | Compact forehand or drive volley | 0.4 | 0.4 | 3.5 f | 0.5 | Disguise as a dink set |
| roll | Topspin forehand brush (§1.7, upward path about 27°) | 0.4 | — | 4 f | 0.6 | Roll peaks at +0.5 f |
| flick | 1HBH topspin with a late wrist (§1.2, 1H column) | 0.3 (wrist set) | — | 2 f | 0.4 | Wrist-dominant |
| atp | Running forehand (§1.10): longer final stride and backswing | 0.6 | 0.5 | 4.5 f | 0.6 | Locomotion carries the body |
| erne | Lateral volley with a crossover or jump (§1.4 side step, §1.10) | 0.4 | — | 3.5 f | 0.4 | Lands after contact |

### 4.3 Final per-shot keys (24 fps, contact = 0)

**Key frames.** Everything stays within ±1 f of `STROKE_TIMING` in `src/core/stroke-motion.ts` (video-measured)
except:
- drive and volley recovery, shortened by 1–2 f;
- the punch hold, which is now a 3 f *moving* hold [T36];
- erne, ATP and smash, whose `A` keys include footwork.

"—" means the key is not used.

| Shot | R | A | L | B | C | F | Hold → | S | R' | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| serve | −12 | −9 (forward rock, ball hand lifts) | −5 | −2 | 0 | +7 | — | +13 | +18 | 30 f, 1.25 s |
| drive FH | −12 | −9 (split landing, unit turn) | −5 | −2 | 0 | +5 | — | +11 | +16 | 28 f, 1.17 s |
| drive 2HBH | −12 | −9 | −5 | −2 | 0 | +5 | — | +11 | +16 | 28 f, 1.17 s |
| dink | −6 | — | −2.5 | −1 | 0 | +5 | — | +10 | +14 | 20 f, 0.83 s |
| drop | −10 | −8 | −4.5 | −2 | 0 | +6 | — | +12 | +18 | 28 f, 1.17 s |
| lob | −7 | — (dink disguise) | −4 | −1.5 | 0 | +7 | — | +14 | +20 | 27 f, 1.13 s |
| volley | −5 | — | −2.5 | −1 | 0 | +3 | — | +7 | +12 | 17 f, 0.71 s |
| smash | −14 | −11 (turn and drop step, off arm up) | −6 (trophy, 1 f cushion) | −2.5 (paddle drop) | 0 | +8 | — | +14 | +20 | 34 f, 1.42 s |
| block | −4 | — | −2 (face set) | — | 0 | +3 | — | +7 | +11 | 15 f, 0.63 s |
| punch | −5 | — | −2.5 | −1 | 0 | +3 | +6 (`drift`, 3 %) | +9 | +12 | 17 f, 0.71 s |
| reset | −6 | — | −2.5 | −1 | 0 | +4 | — | +9 | +13 | 19 f, 0.79 s |
| speedup | −8 | −6 (dink-like set) | −3.5 | −1.5 | 0 | +4 | — | +9 | +14 | 22 f, 0.92 s |
| roll | −7 | — | −4 | −1.5 | 0 | +4.5 | — | +9.5 | +14 | 21 f, 0.88 s |
| flick | −5 | — | −2 (wrist set) | −0.75 | 0 | +3 | — | +7 | +12 | 17 f, 0.71 s |
| atp | −19 (run starts) | −10 (outside-foot approach) | −4.5 | −2 | 0 | +5 | — | +12 | +19 (recovery run) | 38 f, 1.58 s |
| erne | −11 (close-leg step) | −6 (push or jump) | −3.5 | −1.5 | 0 | +2.5 (land at +3) | — | +9 | +17 | 28 f, 1.17 s |

**Notes.**
- **Volley follow.** The volley follow is +3 f, not +4 f. With the `technique-research.md` E2 poses, v_C ≈ 4.9 m/s
  needs m_out = 3.56 at 4 f, which overshoots. At 3 f, m_out ≈ 2.7 [calc].
- **Serve ball release.** A ball dropped from rest 0.5 m above contact falls in √(2·0.5/9.81) = 0.32 s, so release it
  at **−8 f** [calc].

**Per-segment timing** (format: reversal / peak, in frames; paddle peak = 0 for every shot). These are tennis §2
values ×≈0.8, rounded to 0.25 f. The reason is lower effort and a lighter implement [est]. Touch shots move as one
unit [T11].

| Shot | Pelvis (reversal / peak) | Chest (reversal / peak) | Arm peak | Wrist lag maximum | Forearm roll peak | Weight-shift peak | Knee-drive peak |
|---|---|---|---|---|---|---|---|
| serve | −6 / −1.5 | −5 / −1 | −0.5 (pendulum from the shoulder) | −2 → 0. The head stays **below** the wrist at C. | none (no pronation) | −2.5 | −3 |
| drive FH | −6.5 / −1.5 | −5 / −1 | −0.75 | −1 | +0.5 | −2 | −3 |
| drive 2HBH | −6.5 / −2.5 (hip) | −5 / −1.5 | −0.75 (elbow); trail hand 0 | −0.5 | +0.25 | −2 | −3 |
| drop | −5.5 / −1.5 | −4.5 / −1 | −0.5 | −0.5 | none | −2 | −2.5 (small) |
| lob | −5 / −1.25 | −4 / −0.75 | −0.5 | none (face open) | none | −1.5 | −2 (lifts) |
| smash | −7 / −2 | −6 / −1.5 | −1 | −2.5 | +0.5 (pronation) | −2 | −4 |
| speedup | −4.5 / −1.25 | −3.5 / −0.75 | −0.5 | −0.75 | +0.5 | −1.5 | −2 |
| roll | −5 / −1 | −4 / −0.5 | −0.5 | −1 (head dips) | **+0.5 (brush)** | −1.5 | −2 |
| atp | −5.5 / −1.5 | −4.5 / −1 | −0.75 | −1 | +0.5 | Planted outside leg | −2.5 |
| volley, punch | about −3 / −0.5 | −2.5 / −0.25 | 0 | none (firm) | none | −1 (step) | none |
| dink, reset, block | ±0.25 (unit) | ±0.25 | 0 | none (locked) | none | none | none (stay low) |
| flick | −2.5 / −0.5 | −2 / −0.5 | −0.5 (forearm leads) | **set at L, snap peaks at −0.25 → 0** | +0.25 | none | none |
| erne | Body translation peak about −3 (jump) | −3.5 / −0.25 | 0 | none | none | Lateral | Push at −6 |

**Easing per shot.** Use the curve IDs from §3. The channel assignment is §3.3.

| Shot group | A → L | L → C (m_in) | C → F | F → R' | Special |
|---|---|---|---|---|---|
| serve | `takeback` (pendulum back) | `swing`, m_in 2.0–2.2 | `follow` (m_out ≈ 2.6) | `settleOut` → `inOut` | Weight `weight` −9 → +2. Ball release at −8 f. |
| drive FH / 2HBH, atp | `takeback` | `swing`, m_in 2.2–2.4 | `follow` (m_out ≈ 1.5–1.7 with the E2 poses; fine) | same | Pelvis and chest on their own curves (§3.3) |
| smash | `takeback` to the trophy, then `drift` 1 f | Two parts: L → B `swingSoft` (drop), B → C `swing` (m_in 2.4 over the B → C arc) | `follow` | same | The path must include the drop loop (§4.5) |
| drop, lob, roll, speedup | `takeback` | `swingSoft`, m_in 2.0 (speedup 2.4) | `followSoft` | same | Roll: `roll` channel keyed at +0.5 f |
| volley | `takeback` (short) | `swingSoft`, m_in 2.0 | `followSoft` over 3 f | same | Single unit |
| punch | `takeback` | `swing`, m_in 2.2 | `follow` to F, then `drift` F → +6 f | same | No dead stop |
| dink, reset | `takeback` | `swingSoft`, m_in 1.6–1.8 | `followSoft` | same | Pelvis height constant |
| block | `takebackStop` (face set) | `swingSoft`, m_in 1.3–1.6 | `absorb` | same | Tiny displacement |
| flick | `takeback` (wrist set) | Forearm `swingSoft`; wrist channel `roll`-type, end slope 2.75 at C | `followSoft` | same | The snap is the last 30 % |
| erne | Footwork `inOut` | `swingSoft`, m_in 2.0 | `followSoft` | Landing spring | Keep the hop's zero velocity at take-off and landing (existing sin²) |

### 4.4 Serve: what transfers from tennis and what must not

**Transfer.**
- The proximal-to-distal chain, scaled down. Legs and trunk supply about half of the energy [T2]. Pickleball
  equivalent: back → front weight shift with a peak at −2.5 f, pelvis peak at −1.5 f, chest at −1 f.
- The pre-swing rhythm: release the ball at a consistent time (−8 f [calc]).
- A *short* cushion at the top of the backswing (≤ 1–2 f), like the trophy pause. The serve research describes
  storing energy in preparation and using it in acceleration [T2].
- A follow-through toward the target that ends high (`video-guide.md`: hand ≥ head height).

**Must not transfer.**
- The overhead arm path, the trophy pose, 172° shoulder ER, the elbow at 104° [T2], the 48° trunk tilt [T2], and
  the racket drop behind the back.
- Forearm pronation or wrist flexion that brings the head above the wrist at contact. Pickleball serve rules: contact
  at or below the navel, head below the wrist, upward arc (`technique-research.md` A1, [10] there).
- The leg-drive jump. In tennis the lead knee extends at up to 800 °/s about 180 ms before contact [T2]. In
  pickleball one foot stays grounded (`video-guide.md`).
- Tennis serve durations: more than 2 s in total, with the toss 0.7–1.1 s before contact [T19][T21].
- Racket speeds of 38–47 m/s [T2]. The pickleball serve ball travels at about 18–27 m/s [T48][T49].

### 4.5 Contact-speed sanity checks (programmer can assert these)

Hand speed at contact: tennis wrist and hand speeds are 6.3–8.0 m/s [T5][T6][T10]. Tennis volley wrist speeds are
4.3–5.1 m/s [T11]. Using the `technique-research.md` E2 poses [calc]:

| Shot | Hand travel L → C | Forward swing | m_in | v_C | Verdict |
|---|---|---|---|---|---|
| serve | 1.0 m | 5 f | 2.0 | 9.6 m/s | OK for a pendulum serve [est] |
| drive FH | 0.76 m | 5 f | 2.2 | ≈ 8.0 m/s | At the top of the tennis range. OK. |
| volley | 0.25 m | 2.5 f | 2.0 | 4.9 m/s | Matches tennis volleys |
| dink | 0.16 m | 2.5 f | 1.6–1.8 | 2.4–2.8 m/s | OK |
| smash | 0.67 m (straight line) | 6 f | 2.4 | 6.5 m/s | **Too slow.** Model the drop loop (arc length about 1.0–1.2 m) so v_C ≈ 9–10 m/s [est]. |
| lob | **0.10 m** (dink disguise) | 4 f | 2.4 | 1.4 m/s | **Too slow** for a lob that must reach the baseline. Hold the disguise to about −5 f, then drop the hand 0.4–0.5 m below and behind contact so L → C ≥ 0.4 m. With m_in 2.2 over 4 f, v_C ≈ 5.9 m/s. Over the 1.32 m, 7 f follow, m_out ≈ 1.3, a gentle deceleration that suits the long upward lob finish. F at +8 f gives 1.5. |

Assert: v_C ∈ [2, 10] m/s, peak hand speed within ±1 f of contact, and m_out ≤ 3.

---

## 5. Open datasets and Mixamo

### 5.1 Datasets

The user downloads these; nothing was downloaded here.

- **THETIS (2013).**
  - Contents: 12 tennis actions (forehand flat, open stance and slice; backhand 1H, 2H and slice; forehand and
    backhand volleys; flat, kick and slice serves; smash), performed by 55 players (31 amateurs and 24 experienced).
    It includes RGB, depth and Kinect 2D/3D skeletons [T51][T52].
  - Reported counts vary: 1,980 RGB videos [T52], or 1,217 2D/3D skeleton videos [T53].
  - **The strokes are swung without a ball** [T52].
  - The authors say it is freely available for research. No formal licence was found, so assume research-only.
  - Kinect skeletons are noisy, but usable for coarse phase timing.
- **3DTennisDS (Lublin University of Technology, 2024).**
  - Captured with Vicon optical motion capture: Plug-in Gait (39 markers) plus 7 racket markers.
  - Strokes: forehand and backhand with and without a ball, and forehand and backhand volleys, all hit while moving.
    11 professional players. C3D files, downloaded per player as ZIPs [T54][T55].
  - No formal licence. The site asks that use be clearly indicated and the papers cited.
  - It is the best source to measure our own frame timings from the racket markers. It is marker data, so it needs a
    skeleton solve before retargeting.
- **Vid2Player3D (NVIDIA/Stanford, SIGGRAPH 2023).**
  - Physically simulated tennis skills learned from broadcast video [T56].
  - The repository [T57] ships code and a data folder through a Google Drive link. Trained models are withheld
    because of the footage licence.
  - SMPL needs its own licence.
- **CMU MoCap.** No tennis subject was found. Under the original CMU terms the data is free for research and may ship
  inside commercial products, but may not be resold. The 4TU FBX conversion is labelled CC BY-NC 4.0 [T58].
- **Others.**
  - A 2D tennis pose image dataset in COCO format (Data in Brief 2024) [T59].
  - Paid packs: Fab "Tennis Shots" and "Male Tennis Player Animated"
    (`motion-sources.md` A2).
  - The Rokoko free sports pack is on the Mixamo skeleton, with commercial use allowed after sign-up
    (`motion-sources.md` A2).

### 5.2 Mixamo

- **No tennis or racket clip evidence was found**; this agrees with `motion-sources.md`.
- The forums do show that Mixamo has **baseball** clips: a "baseball hit" preset and a baseball swing [T60]. A
  complaint thread names a **golf** swing clip ("Golf swing while standing on one leg") [T61].
- Reallusion's iClone Sport Motion Pack (not Mixamo) lists "golf drive" and "baseball hit" [T62].

**Search terms for the user (logged in):** `tennis`, `racket`, `swing`, `golf`, `baseball`, `bat`, `hit`, `throw`,
`pitch`, `volleyball`, `serve`, `spike`, `slash`, `block`.

**How to use them.**
- Use clips only as a **timing and overlap reference**: the anticipation/hold rhythm and the off-arm counter.
- Do not use them as stroke data. A bat swing is two-handed and much longer.
- Licence notes are in `motion-sources.md` A4. Do not redistribute the raw files.

---

## 6. Implementation checklist (programmer)

1. **Keys.** For each shot, store `{key, frame, value per channel, tangent (units/s) or curve ID}` from §4.3. Convert
   with t = frame / 24. Evaluate in continuous time at the display rate. The 24 fps grid is for authoring, not
   rendering.
2. **The paddle/hand channel owns contact.**
   - Its `C` key sits at exactly t = 0, its value is the IK target (`ball − R·faceOffset`), and its tangent is v_C.
   - Body channels (pelvis, chest, weight, knees, off arm) get their **own key times**: the reversal and peak frames
     in §4.3. They are **not** keyed at contact.
   - IK closes the gap, so per-segment offsets can never break contact exactness. Never time-shift the hand channel
     near contact.
3. **C¹ everywhere.**
   - Use one tangent per key per channel (TCB with c = 0 [T42]).
   - Store tangents per second and multiply by the segment duration in the Hermite (already done in
     `motion-curve.ts`).
   - Check that m = v·T/Δ ≤ 3 on both sides of every key (Fritsch–Carlson [T41]).
   - If the follow violates it, change the **follow duration**, not v_C.
4. **Contact tangent rules.**
   - v_C = m_in·Δ_LC/T_LC, with m_in from the §4.3 easing table.
   - The paddle's peak speed must fall within ±1 f of contact and never before −1 f [T1].
   - Speed only decreases after contact. The forearm roll may peak at +0.5 f.
5. **Breakdown.** For power curves, place B at 0.6·T_LC with value Δ·0.6^p and velocity p·0.6^(p−1)·Δ/T. B is also a
   *spatial* waypoint that defines the arc. Keep the path non-collinear (`technique-research.md` C5).
6. **Settle.**
   - F → S uses `settleOut` to a key 5–8 % past ready, then `inOut` (or the quintic `settle()`) to R'.
   - Alternatively, use a critically damped spring seeded with the current velocity, half-life 0.08–0.12 s [T40].
   - Never use `easeOutBack` from rest.
7. **Holds.**
   - No dead holds. Anything shorter than 6 f must be an ease, not a stop [T36].
   - Punch finish: `drift` over 3 f with 3 % travel.
   - Load cushion = the `takeback` end slope (0.10), not extra frames.
8. **Time pressure** (T_avail < nominal):
   1. Drop `A` first.
   2. Compress A → L and R → A next.
   3. Then shrink the backswing amplitude.
   - Keep L → C at least the §4.3 swing frames minus 1 f.
   - Never lengthen L → C to "fill" time. Extra time goes into ready or footwork.
9. **Slow motion.** Only a debug playback clock (`timeScale`) may slow the animation, and its default must be 1. Do
   not multiply key times, `STROKE_TIMING` or `prepare` by a factor. A 5–9× slowdown makes a 5 f swing 25–45 f, which
   is slower than a whole tennis forehand (§0).
10. **Do not:**
    - Use linear segments.
    - Ease out *into* contact.
    - Apply the same curve to every channel. That is twinning; pelvis, chest and hand must peak at different frames.
    - Offset the hand channel at contact.
    - Bake into a three.js `AnimationClip` with `InterpolateSmooth`. `CubicInterpolant` derives tangents from
      neighbouring keys and accepts no explicit tangents [T63], so it would lose v_C. Either evaluate our own Hermite,
      or bake at ≥ 60 Hz with linear interpolation.
11. **Readability at 24 fps.** Around contact the paddle face moves about 0.4–0.7 m per frame (10–16 m/s [est]). If
    the app ever renders at a stylised 24 fps, add a 1–2 f paddle trail or smear [T64]. At 60 fps, plain motion is
    enough.
12. **Tests to add** (per shot, both handedness):
    - Total R → R' within ±2 f of §4.3.
    - Pelvis peak < chest peak < hand peak ≤ +0.5 f.
    - |v(t⁻) − v(t⁺)| < ε at every key.
    - No segment with constant velocity over ≥ 2 f.
    - v_C within the §4.5 range.
    - m_out ≤ 3.
    - Hand velocity monotonic on L → C.
    - No ≥ 2 f run of identical poses, except an explicit `drift`.

---

## References

### Tennis biomechanics

- [T1] Landlinger et al. 2010, *Key factors and timing patterns in the tennis forehand of different skill levels*, JSSM. https://pmc.ncbi.nlm.nih.gov/articles/PMC3761808
- [T2] Kovacs & Ellenbecker 2011, *An 8-stage model for evaluating the tennis serve*, Sports Health. https://pmc.ncbi.nlm.nih.gov/articles/PMC3445225
- [T5] Song, Zhou & Guo 2015, *Kinematic analysis of forehand stroke technology of … Nadal*, ICMSE. https://www.atlantis-press.com/article/25845670.pdf
- [T6] Li & Zhou 2018, *Kinematical analysis on the forehand stroke technique of … Aarno Ruusuvuori*, ICMSE. https://www.atlantis-press.com/article/25895044.pdf
- [T7] Forehand elbow kinematics: ATP carrying-angle study, as summarised in search results. https://iris.unilink.it/handle/20.500.14085/67783
- [T8] Reid, Elliott & Crespo 2013, *Mechanics and learning practices associated with the tennis forehand: a review*. https://pmc.ncbi.nlm.nih.gov/articles/PMC3761830
- [T9] Genevois et al. 2015, *Performance factors related to the different tennis backhand groundstrokes: a review*, JSSM. https://pmc.ncbi.nlm.nih.gov/articles/PMC4306773/
- [T10] Stępień et al. 2011, *The kinematics of trunk and upper extremities in one-handed and two-handed backhand stroke*. https://pmc.ncbi.nlm.nih.gov/articles/PMC3588639/
- [T11] Chao et al. 2008, *Kinematic analysis of tennis volley*, ISBS. https://ojs.ub.uni-konstanz.de/cpa/article/view/1922
- [T12] Chow et al. 1999, *Movement characteristics of the tennis volley*, MSSE. https://pubmed.ncbi.nlm.nih.gov/10378913
- [T13] Carboch et al. 2014, *Ball machine usage in tennis: movement initiation and swing timing while returning balls from a ball machine and from a real server*, JSSM. https://pmc.ncbi.nlm.nih.gov/articles/PMC3990883
- [T14] Cosmos, *The physics of Ash Barty's backhand slice* (Machar Reid). https://cosmosmagazine.com/science/physics/the-physics-of-ash-bartys-backhand-slice
- [T15] Elliott, Marsh & Overheu 1989, *A biomechanical comparison of the topspin and backspin forehand approach shots in tennis*. https://arch.neicon.ru/xmlui/handle/123456789/3739266
- [T16] *Uncovering the hidden mechanics of upper body rotations in tennis serves using wearable sensors on Dutch professional players*, 2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC11746891/
- [T17] López de Subijana & Navarro 2006, *The kinetic chain performed by high performance tennis players*, ISBS. https://ojs.ub.uni-konstanz.de/cpa/article/view/182
- [T18] Miura, Tomosue & Fukunaga, *Effects of joint-fixing on the velocity of the racket head in the tennis serve*, ISBS. https://ojs.ub.uni-konstanz.de/cpa/article/view/2331
- [T19] TennisPlayer (Yandell / Gordon), *The Sampras serve: racket head speed* (200 fps). https://www.tennisplayer.net/public/avancedtennis/john_yandell/sampras_serve/sampras_serve_racket_head_speed/sampras_serve_racket_head_speed.html
- [T20] TennisPlayer, *The upward swing: Federer's serve in high speed*. https://www.tennisplayer.net/article/the-upward-swing-federers-serve-in-high-speed-and-high-def/
- [T21] Tennis View, *How a lower ball toss can help your serve*. https://www.tennisviewmag.com/print/1916
- [T22] Knudson & Bahamonde 2001, *Effect of endpoint conditions on position and velocity near impact in tennis*. https://www.ncbi.nlm.nih.gov/pubmed/11695505
- [T23] Knudson 2005, *Effect of tennis ball mass and smoothing on peak racket velocity*, ISBS. https://ojs.ub.uni-konstanz.de/cpa/article/view/1169
- [T24] Human Kinetics excerpt, *How to execute a perfect overhead smash*. https://us.humankinetics.com/blogs/excerpt/how-to-execute-a-perfect-overhead-smash
- [T25] Ida et al., *Kinematics and kinetics of the racket-arm during the soft-tennis smash under match conditions*. https://www.bisp-surf.de/Record/PU200907003614
- [T26] *Influence of tennis racquet kinematics on ball topspin angular velocity and accuracy during the forehand groundstroke*, JSSM 2017. https://jssm.org/jssm-16-505.xml-abst
- [T27] USHSTA, *Topspin lob drill*. https://ushsta.org/topspin-lob-drill/
- [T28] Mecheri et al. 2019, *Relationship between split-step timing and leg stiffness in world-class tennis players when returning fast serves*. https://pure.port.ac.uk/ws/files/13666713/Mecheri_et_al._Accepted.pdf (record: https://hal.archives-ouvertes.fr/hal-02277006)
- [T29] *The kinematics of the return of serve in tennis: the role of anticipatory information*, The Sport Journal. https://thesportjournal.org/article/the-kinematics-of-the-return-of-serve-in-tennis-the-role-of-anticipatory-information/
- [T30] Uzu, Shinya & Oda 2009, *A split-step shortens the time to perform a choice reaction step-and-reach movement in a simulated tennis task*. https://lida.sport-iat.de/twm/Record/4017156?lng=en
- [T31] ITF Coaching & Sport Science Review, movement in tennis (lateral share, burst distance, shot distance). https://itfcoachingreview.com/index.php/journal/article/download/51/141/194
- [T32] PlayYourCourt, *The foundation behind good footwork: the side shuffle*. https://www.playyourcourt.com/news/the-foundation-behind-good-footwork-the-side-shuffle/?amp=1
- [T33] TennisOne (Van der Meer), movement and recovery. https://tennisone.tennisplayer.net/club/lessons/van.der.meer/movement/movement.php
- [T34] Breakthrough Basketball, *Debunking cross feet*. https://www.breakthroughbasketball.com/defense/debunking-cross-feet
- [T35] *Applying the brakes in tennis: how entry speed affects the movement and hitting kinematics of professional tennis players*, J Sports Sci 2021. https://research-repository.uwa.edu.au/en/publications/applying-the-brakes-in-tennis-how-entry-speed-affects-the-movemen/

### Animation and curves

- [T36] Brian Lemay, *Principles of animation: timing* (24 fps, ones and twos, holds of 2–5 frames, moving holds). https://www.brianlemay.com/Pages/animationschool/animation/lipsyncbook/timing.html
- [T37] W3C, *CSS Easing Functions Level 1* (cubic-bézier definition). https://www.w3.org/TR/css-easing-1/
- [T38] easings.net (named easing families). https://easings.net/
- [T39] Ceaser / Penner cubic-bézier approximations (SCSS gist). https://gist.github.com/manfromanotherland/8a6545c56888398df8f865cce2e857f4
- [T40] Daniel Holden, *Spring-It-On: The Game Developer's Spring-Roll-Call*. https://theorangeduck.com/page/spring-roll-call
- [T41] *Monotone cubic interpolation* (Fritsch–Carlson α, β ≤ 3). https://en.wikipedia.org/wiki/Monotone_cubic_interpolation
- [T42] *Kochanek–Bartels spline* (TCB tangents; c = 0 shares in and out tangents). https://en.wikipedia.org/wiki/Kochanek%E2%80%93Bartels_spline
- [T63] three.js docs, *CubicInterpolant*. https://threejs.org/docs/pages/CubicInterpolant.html
- [T64] *Smear frame*. https://en.wikipedia.org/wiki/Smear_frame (also https://rebusfarm.net/blog/smear-frames-in-animation-how-animators-create-fast-and-dynamic-motion)
- Game references, for context: TopSpin 2K25 used 9 animations per forehand or backhand style, chosen by ball height, direction and the player's speed. https://news.xbox.com/en-us/2024/04/03/signature-gameplay-animations-for-topspin-2k25/
- Tennis World Tour: the shot breakdown from match video, clips "chained one after the other", and the swing preparation starts as soon as the player moves. https://blog.playstation.com/?p=196985 and https://www.fandom.com/articles/tennis-world-tour-preview
- AO Tennis 2 added per-player serve and return animations. https://stevivor.com/news/first-ao-tennis-2-dev-diary-precincts-players/
- Corner-swing blending plus IK for contact. https://gamedev.net/forums/topic/701222-tech-challenge-how-to-avoid-ball-mishits-unity

### Equipment, pickleball and data

- [T43] USA Pickleball rules §2 (paddle ≤ 17 in). https://www.playpickleball.com/2025-usa-pickleball-rules-section-2-court-and-equipment/
- [T44] ITF, *Rackets and strings product conformity* (≤ 29 in). https://m.itftennis.com/media/2177/rackets-and-strings-product-conformity.pdf
- [T45] Tennis Companion, *Tennis racquet length* (27 in standard). https://tenniscompanion.org/tennis-racquet-length/
- [T46] Pickleball Science, *What do the swing weight numbers mean?* https://pickleballscience.org/what-do-the-swing-weight-numbers-mean/
- [T47] Tennis.com, *Pro shop: what can swingweight tell me about my frame?* https://www.tennis.com/baseline/articles/pro-shop-what-can-swingweight-tell-me-about-my-frame
- [T48] Pickleball Science, *How fast is a pickleball?* https://pickleballscience.org/how-fast-is-a-pickleball
- [T49] Pickleball.com, *How fast is a pickleball serve* (pro radar). https://pickleball.com/culture/how-fast-is-a-pickleball-serve-see-exact-serve-mph-of-top-pros-like-ben-johns-and-anna-bright
- [T50] *Pickleball flight dynamics* (arXiv 2409.19000). https://arxiv.org/html/2409.19000v1
- [T51] Gourgari et al. 2013, *THETIS: Three dimensional tennis shots, a human action dataset*, CVPRW. https://mlanthology.org/cvprw/2013/gourgari2013cvprw-thetis
- [T52] *Classification of tennis actions using deep learning* (THETIS description). https://arxiv.org/pdf/2402.02545
- [T53] *A survey on video action recognition in sports* (THETIS counts). https://arxiv.org/pdf/2206.01038
- [T54] 3DTennisDS. https://tennisdb.cs.pollub.pl
- [T55] Skublewska-Paszkowska et al. 2024 (3DTennisDS paper). https://yadda.icm.edu.pl/yadda/element/bwmeta1.element.baztech-05d82f2e-2615-4071-a4f4-5ce1d985065e/c/Skublewska-Paszkowska_Powroznik_Lukasik_Smolka_2024.pdf
- [T56] Zhang et al. 2023, *Learning physically simulated tennis skills from broadcast videos*. https://research.nvidia.com/labs/toronto-ai/vid2player3d
- [T57] nv-tlabs/vid2player3d repository. https://github.com/nv-tlabs/vid2player3d
- [T58] FBX conversion of the CMU database, with the original CMU terms. https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df/1
- [T59] *Tennis player actions dataset for human pose estimation*, Data in Brief 2024. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11282921/
- [T60] Adobe community, Mixamo "baseball hit" preset thread. https://community.adobe.com/t5/mixamo-discussions/adding-objects-to-existing-mixamo-animations-after-mixamo-download/td-p/12573919
- [T61] Adobe community, Mixamo library complaint thread (golf swing clip named). https://community.adobe.com/questions-696/could-mixamo-be-any-worse-it-s-complete-junk-589534
- [T62] Reallusion, *Sport Motion Pack*. https://marketplace.reallusion.com/sport-motion-pack
