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
const bones = new Map<string, T.Object3D>();
g.scene.traverse((o) => { if (/^mixamorig/i.test(String(o.userData?.name ?? o.name))) bones.set(canon(o), o); });
const P = (n: string) => new T.Vector3().setFromMatrixPosition(bones.get(n)!.matrixWorld);
const f = (v: T.Vector3) => v.toArray().map((n) => +n.toFixed(3)).join(", ");
for (const n of ["Hips","Spine","Spine1","Spine2","Neck","Head","HeadTop_End","LeftShoulder","LeftArm","LeftForeArm","LeftHand","LeftHandMiddle1","LeftHandIndex1","LeftHandPinky1","LeftHandThumb1","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase"]) if (bones.has(n)) console.log(n.padEnd(16), f(P(n)));
console.log("upper", P("LeftArm").distanceTo(P("LeftForeArm")).toFixed(3), "fore", P("LeftForeArm").distanceTo(P("LeftHand")).toFixed(3), "clav", P("LeftShoulder").distanceTo(P("LeftArm")).toFixed(3));
// mesh data in bind pose, app space
const pos = sm.geometry.getAttribute("position"), si = sm.geometry.getAttribute("skinIndex"), sw = sm.geometry.getAttribute("skinWeight");
const names = sm.skeleton.bones.map(canon);
const p = new T.Vector3();
const verts: { p: T.Vector3; bone: string; w: number }[] = [];
for (let i = 0; i < pos.count; i++) {
  sm.getVertexPosition(i, p);
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  verts.push({ p: p.clone(), bone: names[best], w: bw });
}
// limb radii for left arm bones
const segDist = (a: T.Vector3, b: T.Vector3, q: T.Vector3) => { const ab = b.clone().sub(a); const u = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / ab.lengthSq())); return { d: q.distanceTo(a.clone().addScaledVector(ab, u)), u }; };
const pct = (arr: number[], q: number) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
for (const [bn, child] of [["LeftArm","LeftForeArm"],["LeftForeArm","LeftHand"],["LeftHand","LeftHandMiddle1"]] as const) {
  const a = P(bn), b = P(child);
  for (let bin = 0; bin < 5; bin++) {
    const ds: number[] = [];
    for (const v of verts) if (v.bone === bn) { const r = segDist(a, b, v.p); if (r.u >= bin / 5 && r.u < (bin + 1) / 5) ds.push(r.d); }
    if (ds.length) console.log(bn.padEnd(12), `u ${bin/5}-${(bin+1)/5}`, "n", ds.length, "r med", pct(ds, .5).toFixed(3), "p90", pct(ds, .9).toFixed(3), "max", Math.max(...ds).toFixed(3));
  }
}
// torso extents by height (vertices dominated by trunk bones, plus all verts with |x| < 0.2 for y bins)
const trunk = new Set(["Hips","Spine","Spine1","Spine2","Neck"]);
console.log("trunk cross sections (dominant trunk bone verts): y-bin, x min/max, z min/max, n");
for (let y = 0.8; y < 1.7; y += 0.05) {
  const vs = verts.filter((v) => trunk.has(v.bone) && v.p.y >= y && v.p.y < y + 0.05);
  if (!vs.length) continue;
  const xs = vs.map((v) => v.p.x), zs = vs.map((v) => v.p.z);
  console.log(y.toFixed(2), "x", Math.min(...xs).toFixed(3), Math.max(...xs).toFixed(3), "z", Math.min(...zs).toFixed(3), Math.max(...zs).toFixed(3), vs.length);
}
const sp = P("Spine2"); console.log("Spine2 joint", f(sp));
