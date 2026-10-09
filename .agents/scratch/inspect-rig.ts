import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const bytes = readFileSync(process.argv[2]);
const g = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
g.scene.updateMatrixWorld(true);
let sm: T.SkinnedMesh | undefined;
g.scene.traverse((o) => { if ((o as T.SkinnedMesh).isSkinnedMesh) sm = o as T.SkinnedMesh; });
const arm = g.scene.getObjectByName("Armature")!;
console.log("Armature", arm.position.toArray(), arm.quaternion.toArray().map(n=>+n.toFixed(4)), arm.scale.toArray());
console.log("mesh node", sm!.position.toArray(), sm!.quaternion.toArray().map(n=>+n.toFixed(4)), sm!.scale.toArray());
const box = new T.Box3(); const p = new T.Vector3(); const pos = sm!.geometry.getAttribute("position");
for (let i = 0; i < pos.count; i++) { sm!.getVertexPosition(i, p); p.applyMatrix4(sm!.matrixWorld); box.expandByPoint(p); }
console.log("skinned world bbox", box.min.toArray().map(n=>+n.toFixed(3)), box.max.toArray().map(n=>+n.toFixed(3)));
const want = ["Hips","Spine","Spine2","Neck","Head","HeadTop_End","LeftShoulder","LeftArm","LeftForeArm","LeftHand","LeftHandMiddle1","RightArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","RightFoot"];
for (const n of want) { const b = sm!.skeleton.getBoneByName("mixamorig" + n) ?? sm!.skeleton.bones.find(x=>x.name.endsWith(n)); if (!b) { console.log(n, "missing"); continue; } b.getWorldPosition(p); console.log(n.padEnd(16), p.toArray().map(n=>+n.toFixed(3))); }
const w = sm!.geometry.getAttribute("skinWeight"); let bad = 0, unused = new Set(sm!.skeleton.bones.map((_,i)=>i)); const idx = sm!.geometry.getAttribute("skinIndex");
for (let i = 0; i < w.count; i++) { const s = w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i); if (Math.abs(s-1)>1e-3) bad++; for (let k=0;k<4;k++) if (w.getComponent(i,k)>0.01) unused.delete(idx.getComponent(i,k)); }
console.log("bad weight sums", bad, "bones with no weight>0.01:", [...unused].map(i=>sm!.skeleton.bones[i].name.replace("mixamorig","")).join(","));
