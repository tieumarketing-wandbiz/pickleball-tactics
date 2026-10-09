import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { BodyVolume, TORSO_SECTIONS } from "../../../src/scene/body-volume";
await MeshoptDecoder.ready;
const bytes = readFileSync("public/models/male-rigged.glb");
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
g.scene.updateMatrixWorld(true);
let sm!: T.SkinnedMesh;
g.scene.traverse((o) => { if ((o as T.SkinnedMesh).isSkinnedMesh) sm = o as T.SkinnedMesh; });
sm.skeleton.update();
const canon = (b: T.Object3D) => String(b.userData?.name ?? b.name).replace(/^mixamorig\d*[:_]?/i, "");
const bones = new Map<string, T.Object3D>();
g.scene.traverse((o) => { if (/^mixamorig/i.test(String(o.userData?.name ?? o.name))) bones.set(canon(o), o); });
const P = (n: string) => new T.Vector3().setFromMatrixPosition(bones.get(n)!.matrixWorld);
const body = new BodyVolume();
const I = new T.Quaternion();
body.update((s) => P(s.bone), () => I, [[P("LeftUpLeg"), P("LeftLeg")], [P("RightUpLeg"), P("RightLeg")]]);
const pos = sm.geometry.getAttribute("position"), si = sm.geometry.getAttribute("skinIndex"), sw = sm.geometry.getAttribute("skinWeight");
const names = sm.skeleton.bones.map(canon);
const v = new T.Vector3();
const rows = new Map<string, number[]>();
for (let i = 0; i < pos.count; i++) {
  sm.getVertexPosition(i, v);
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  const b = names[best];
  if (!["Hips", "Spine", "Spine1", "Spine2"].includes(b)) continue;
  const gp = body.gap(v);
  const key = b;
  (rows.get(key) ?? rows.set(key, []).get(key)!).push(gp);
}
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
for (const [k, a] of rows) console.log(k.padEnd(8), "n", a.length, "gap p5", pct(a, .05).toFixed(3), "p25", pct(a, .25).toFixed(3), "med", pct(a, .5).toFixed(3), "p75", pct(a, .75).toFixed(3), "p95", pct(a, .95).toFixed(3), "min", Math.min(...a).toFixed(3), "max", Math.max(...a).toFixed(3));
// also report the nearest-surface test: for arm vertices (rest pose) far from the shoulder how far outside
console.log("--- deep-inside trunk verts");
let shown = 0;
for (let i = 0; i < pos.count && shown < 25; i++) {
  sm.getVertexPosition(i, v);
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  const b = names[best];
  if (!["Spine", "Spine2"].includes(b)) continue;
  const gp = body.gap(v);
  if (gp < -0.04) { shown++; console.log(b, v.toArray().map((n) => +n.toFixed(3)).join(","), "gap", gp.toFixed(3), "w", bw.toFixed(2)); }
}
