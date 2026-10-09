// Proposes R / S / R' frames per shot so takeback and recovery peak speeds stay within budget
// for the default contact geometry (A1 at z=3.6, contact 0.4 ahead / 0.4 to the forehand side).
import { SHOT_TYPES, DEFAULT_HEIGHT } from "../../../src/core/constants";
import { STROKE_KEYS, STROKE_MOTION, paddlePathStats, samplePaddlePath, strokePreparation, strokeKeyTimes } from "../../../src/core/stroke-motion";
import { READY_PADDLE } from "../../../src/core/player-pose";
const PEAK = 1.48, V_OUT = 4.0;
for (const type of SHOT_TYPES) {
  const h = DEFAULT_HEIGHT[type], cx = 0.4, cz = -0.4;
  const len = Math.hypot(-0.4, -7.6), dx = -0.4 / len, dz = -7.6 / len, lx = -dz, lz = dx;
  const rx = READY_PADDLE.side - cx, rz = -READY_PADDLE.ahead - cz;
  const ready: [number, number, number] = [rx * dx + rz * dz, rx * lx + rz * lz, READY_PADDLE.height - h];
  const prep = strokePreparation(type), k = STROKE_KEYS[type], t = strokeKeyTimes(type, prep), st = paddlePathStats(type, prep, ready);
  const p = STROKE_MOTION[type];
  const d3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const amp = 1, L = p.load.map((x) => x * amp), S = ready.map((r, c) => r + (r - p.follow[c]) * k.settle);
  const lenRL = d3(ready, L), lenFS = d3(p.follow, S);
  const V = Math.max(0.75 * st.vC, V_OUT);
  const needRL = lenRL * PEAK / V, needFS = lenFS * PEAK / V;
  const R = Math.min(k.R, Math.round((t.L - needRL) * 24 - 0.5));
  const Sf = Math.max(k.S, Math.ceil((t.F + needFS) * 24));
  const Rp = Math.max(k.Rp, Sf + Math.max(3, k.Rp - k.S));
  // measured peaks outside the swing with the current table
  const pos = (tt: number) => samplePaddlePath(type, tt, prep, ready);
  const speed = (tt: number) => { const a = pos(tt - 1e-5), b = pos(tt + 1e-5); return d3(a, b) / 2e-5; };
  let takeback = 0, recovery = 0;
  for (let tt = t.R; tt < t.L; tt += 1 / 480) takeback = Math.max(takeback, speed(tt));
  for (let tt = t.F; tt < t.Rp; tt += 1 / 480) recovery = Math.max(recovery, speed(tt));
  console.log(`${type.padEnd(8)} vC ${st.vC.toFixed(2)} V ${V.toFixed(1)} | lenRL ${lenRL.toFixed(2)} takeback ${takeback.toFixed(1)} (R ${k.R} -> ${R}) | lenFS ${lenFS.toFixed(2)} recovery ${recovery.toFixed(1)} (S ${k.S} -> ${Sf}, Rp ${k.Rp} -> ${Rp})`);
}
