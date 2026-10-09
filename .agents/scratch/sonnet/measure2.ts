import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
await MeshoptDecoder.ready;
const bytes = readFileSync("public/models/male-rigged.glb");
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
g.scene.updateMatrixWorld(true);
let sm!: T.SkinnedMesh;
g.scene.traverse((o) => { if ((o as T.SkinnedMesh).isSkinnedMesh) sm = o as T.SkinnedMesh; });
sm.skeleton.update();
const canon = (b: T.Object3D) => String(b.userData?.name ?? b.name).replace(/^mixamorig\d*[:_]?/i, "");
const pos = sm.geometry.getAttribute("position"), si = sm.geometry.getAttribute("skinIndex"), sw = sm.geometry.getAttribute("skinWeight");
const names = sm.skeleton.bones.map(canon);
const p = new T.Vector3();
const verts: { p: T.Vector3; bone: string }[] = [];
for (let i = 0; i < pos.count; i++) {
  sm.getVertexPosition(i, p);
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  verts.push({ p: p.clone(), bone: names[best] });
}
const isLimb = (b: string) => /Arm$|ForeArm$|Hand/.test(b);
const isLeg = (b: string) => /Leg$|Foot|Toe/.test(b);
console.log("y   | torso(no limbs/legs) xmax zfront zback | incl Shoulder bones | with UpLeg");
for (let y = 0.85; y < 1.75; y += 0.05) {
  const row = (filter: (b: string) => boolean) => {
    const vs = verts.filter((v) => filter(v.bone) && v.p.y >= y && v.p.y < y + 0.05 && Math.abs(v.p.x) < 0.3);
    if (!vs.length) return "-";
    return `${Math.max(...vs.map((v) => Math.abs(v.p.x))).toFixed(3)} ${Math.min(...vs.map((v) => v.p.z)).toFixed(3)} ${Math.max(...vs.map((v) => v.p.z)).toFixed(3)} (${vs.length})`;
  };
  console.log(y.toFixed(2), "|", row((b) => !isLimb(b) && !isLeg(b) && !/Shoulder/.test(b) && b !== "Head"), "|", row((b) => !isLimb(b) && !isLeg(b) && b !== "Head"), "|", row((b) => !isLimb(b) && !/Foot|Toe|Leg$/.test(b) && b !== "Head"));
}
// all-vertices silhouette near the shoulders: arm verts at u<0.3 of the upper arm
const bones = new Map<string, T.Object3D>();
g.scene.traverse((o) => { if (/^mixamorig/i.test(String(o.userData?.name ?? o.name))) bones.set(canon(o), o); });
const P = (n: string) => new T.Vector3().setFromMatrixPosition(bones.get(n)!.matrixWorld);
// distribution of vertices dominated by LeftArm vs distance from the arm joint
const S = P("LeftArm");
const near = verts.filter((v) => v.bone === "LeftArm").map((v) => v.p.distanceTo(S));
near.sort((a, b) => a - b);
console.log("LeftArm verts distance from shoulder joint: min", near[0].toFixed(3), "p10", near[Math.floor(near.length * .1)].toFixed(3), "median", near[Math.floor(near.length / 2)].toFixed(3));
// hand extents
const H = P("LeftHand");
const hv = verts.filter((v) => v.bone.startsWith("LeftHand"));
console.log("left hand verts", hv.length, "extent from wrist: max dist", Math.max(...hv.map((v) => v.p.distanceTo(H))).toFixed(3));
// head extents
const hd = verts.filter((v) => v.bone === "Head" || v.bone === "Neck");
console.log("head+neck y", Math.min(...hd.map((v) => v.p.y)).toFixed(3), Math.max(...hd.map((v) => v.p.y)).toFixed(3), "z", Math.min(...hd.map((v) => v.p.z)).toFixed(3), Math.max(...hd.map((v) => v.p.z)).toFixed(3), "xmax", Math.max(...hd.map((v) => Math.abs(v.p.x))).toFixed(3));
for (let y = 1.5; y < 1.8; y += 0.05) { const vs = hd.filter((v) => v.p.y >= y && v.p.y < y + 0.05); if (vs.length) console.log(" head y", y.toFixed(2), "x", Math.max(...vs.map((v) => Math.abs(v.p.x))).toFixed(3), "z", Math.min(...vs.map((v) => v.p.z)).toFixed(3), Math.max(...vs.map((v) => v.p.z)).toFixed(3)); }
console.log("--- sagittal silhouette (|x|<0.06) and widest x at |z|<0.06, all bones except Head/limb-dominated beyond |x|>0.19");
for (let y = 0.80; y < 1.62; y += 0.04) {
  const vs = verts.filter((v) => v.p.y >= y && v.p.y < y + 0.04 && Math.abs(v.p.x) < 0.06 && v.bone !== "Head");
  const ws = verts.filter((v) => v.p.y >= y && v.p.y < y + 0.04 && Math.abs(v.p.z) < 0.07 && !isLimb(v.bone) && v.bone !== "Head" && (y > 1.0 || !/Leg/.test(v.bone)));
  console.log(y.toFixed(2), "z", vs.length ? `${Math.min(...vs.map((v) => v.p.z)).toFixed(3)} .. ${Math.max(...vs.map((v) => v.p.z)).toFixed(3)}` : "-", "(", vs.length, ")", " halfwidth", ws.length ? Math.max(...ws.map((v) => Math.abs(v.p.x))).toFixed(3) : "-", "(", ws.length, ")");
}
