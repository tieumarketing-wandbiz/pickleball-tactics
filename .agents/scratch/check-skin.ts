import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const bytes = readFileSync(process.argv[2]);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const g = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
g.scene.updateMatrixWorld(true);
let sm: T.SkinnedMesh | undefined;
g.scene.traverse((o) => { if ((o as T.SkinnedMesh).isSkinnedMesh) sm = o as T.SkinnedMesh; });
sm!.skeleton.update();
const box = new T.Box3(), raw = new T.Box3(), p = new T.Vector3(); const pos = sm!.geometry.getAttribute("position");
for (let i = 0; i < pos.count; i++) { raw.expandByPoint(p.fromBufferAttribute(pos, i)); sm!.getVertexPosition(i, p); p.applyMatrix4(sm!.matrixWorld); box.expandByPoint(p); }
const f = (v: T.Vector3) => v.toArray().map((n) => +n.toFixed(3));
console.log("bones", sm!.skeleton.bones.length, "verts", pos.count, "normalized attr", (pos as any).normalized);
console.log("raw attr bbox", f(raw.min), f(raw.max));
console.log("skinned bbox", f(box.min), f(box.max));
for (const n of ["Hips", "LeftHand", "RightHand", "LeftFoot", "LeftToeBase", "Head"]) { const b = sm!.skeleton.bones.find((x) => x.name.endsWith(n))!; b.getWorldPosition(p); console.log(n.padEnd(12), f(p)); }
