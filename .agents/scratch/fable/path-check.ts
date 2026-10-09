// Checks the authored paddle path per shot: contact speed, m_out, peak time, key continuity, monotone swing.
import { SHOT_TYPES } from "../../../src/core/constants";
import { samplePaddlePath, paddlePathStats, strokeKeyTimes, strokePreparation, STROKE_KEYS } from "../../../src/core/stroke-motion";
const ready: [number, number, number] = [-0.55, 0.3, 0.5];
for (const type of SHOT_TYPES) {
  const prep = strokePreparation(type), k = strokeKeyTimes(type, prep), st = paddlePathStats(type, prep, ready);
  const h = 1e-5, pos = (t: number) => samplePaddlePath(type, t, prep, ready);
  const vel = (t: number) => { const a = pos(t - h), b = pos(t + h); return a.map((x, i) => (b[i] - x) / (2 * h)); };
  let peak = 0, peakT = 0, mono = true, prevSpeed = 0;
  for (let t = k.R - 0.05; t <= k.Rp + 0.05; t += 1 / 480) {
    const s = Math.hypot(...vel(t)); if (s > peak) { peak = s; peakT = t; }
    if (t >= k.L && t <= 0) { if (s < prevSpeed - 1e-6) mono = false; prevSpeed = s; }
  }
  const jumps = [k.R, k.A, k.L, k.B, 0, k.F, k.H, k.S, k.Rp].filter((x): x is number => x !== undefined).map((t) => {
    const l = vel(t - 3 * h), r = vel(t + 3 * h), pl = pos(t - 3 * h), pr = pos(t + 3 * h);
    return { t, dp: Math.hypot(...pl.map((x, i) => x - pr[i])), dv: Math.hypot(...l.map((x, i) => x - r[i])) };
  }).filter((j) => j.dp > 1e-4 || j.dv > 0.02);
  console.log(`${type.padEnd(8)} vC ${st.vC.toFixed(2)} m/s lenLC ${st.lenLC.toFixed(2)} lenCF ${st.lenCF.toFixed(2)} mOut ${st.mOut.toFixed(2)} | peak ${peak.toFixed(2)}@${(peakT * 24).toFixed(2)}f mono ${mono} | total ${((k.Rp - k.R) * 24).toFixed(0)}f R ${(k.R * 24).toFixed(1)} L ${(k.L * 24).toFixed(1)} | jumps ${JSON.stringify(jumps)}`);
}
