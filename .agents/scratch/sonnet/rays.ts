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
const pos = sm.geometry.getAttribute("position");
const vs: T.Vector3[] = [];
for (let i = 0; i < pos.count; i++) vs.push(sm.getVertexPosition(i, new T.Vector3()));
const idx = sm.geometry.index!;
const tris: [T.Vector3, T.Vector3, T.Vector3][] = [];
for (let i = 0; i < idx.count; i += 3) tris.push([vs[idx.getX(i)], vs[idx.getX(i + 1)], vs[idx.getX(i + 2)]]);
console.log("tris", tris.length);
const ray = new T.Ray();
const out = new T.Vector3();
function cast(o: T.Vector3, d: T.Vector3) {
  ray.set(o, d);
  let best = Infinity;
  for (const [a, b, c] of tris) {
    const hit = ray.intersectTriangle(a, b, c, false, out);
    if (hit) { const t = hit.distanceTo(o); if (t < best) best = t; }
  }
  return best;
}
// cross-section radii at heights, from axis (x=0,z=zc) in 12 directions (angle 0 = +x, 90 = -z front)
for (const y of [0.92, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45]) {
  // find centre: cast along z both ways from z=0, x=0
  const f = cast(new T.Vector3(0, y, 0.0), new T.Vector3(0, 0, -1)), b = cast(new T.Vector3(0, y, 0.0), new T.Vector3(0, 0, 1));
  const zc = (-f + b) / 2;
  const row: string[] = [];
  for (const deg of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
    const a = (deg * Math.PI) / 180;
    const d = new T.Vector3(Math.cos(a), 0, -Math.sin(a)); // 90deg = front (-z)
    row.push(cast(new T.Vector3(0, y, zc), d).toFixed(3));
  }
  console.log("y", y.toFixed(2), "zc", zc.toFixed(3), "front", f.toFixed(3), "back", b.toFixed(3), "| r@0,30..330 (0=+x, 90=front):", row.join(" "));
}
