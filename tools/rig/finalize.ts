import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Document, NodeIO, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptEncoder } from "meshoptimizer";
import { meshopt, quantize, reorder, weld } from "@gltf-transform/functions";

if (!process.argv.includes("--from-source")) throw new Error("Use --from-source (v1 heuristic mode retired).");
const input="tools/rig/source/human-rig.glb", output="public/models/male-rigged.glb";
await MeshoptEncoder.ready;
const data=await readFile(input), array=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const loader=new GLTFLoader(); const sourceThree=await loader.parseAsync(array,""), skeletonMeshes:T.SkinnedMesh[]=[];
sourceThree.scene.updateMatrixWorld(true); sourceThree.scene.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)skeletonMeshes.push(o as T.SkinnedMesh);});
if(skeletonMeshes.length!==1)throw new Error(`Expected one SkinnedMesh, got ${skeletonMeshes.length}`);
const sourceMesh=skeletonMeshes[0]; sourceMesh.skeleton.pose(); sourceThree.scene.updateMatrixWorld(true); sourceMesh.bindMode="attached"; sourceMesh.updateMatrixWorld(true);
const original=[] as T.Vector3[]; for(let i=0;i<sourceMesh.geometry.getAttribute("position").count;i++) original.push(sourceMesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(sourceMesh.matrixWorld));
const rotation=new T.Matrix4().makeRotationY(-Math.PI/2), scale=new T.Matrix4().makeScale(1.8,1.8,1.8), rs=rotation.clone().multiply(scale);
const transformed=original.map(p=>p.clone().applyMatrix4(rs)); const minY=Math.min(...transformed.map(p=>p.y)), minX=Math.min(...transformed.map(p=>p.x)), maxX=Math.max(...transformed.map(p=>p.x));
const translation=new T.Matrix4().makeTranslation(-(minX+maxX)/2,-minY,0), N=translation.clone().multiply(rs);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.encoder":MeshoptEncoder,"meshopt.decoder":(await import("meshoptimizer")).MeshoptDecoder});
const doc=await io.read(input), root=doc.getRoot(), skins=root.listSkins(), skin=skins[0]; if(!skin)throw new Error("No source skin");
const meshNodes=root.listNodes().filter(n=>n.getMesh()); if(meshNodes.length!==1)throw new Error("Expected one mesh node"); const meshNode=meshNodes[0];
// Remove unweighted Mixamo terminal markers, remapping all four joint slots before changing skin order.
const removeName=(n:string)=>/(?:Hand(?:Thumb|Index|Middle|Ring|Pinky)?4|Toe_End|HeadTop_End)$/.test(n.replace(/^mixamorig[:_]?/,""));
const oldJoints=skin.listJoints(), kept=oldJoints.filter(j=>!removeName(j.getName())), remap=new Map<number,number>(); kept.forEach((j,i)=>remap.set(oldJoints.indexOf(j),i));
for(const mesh of root.listMeshes())for(const prim of mesh.listPrimitives()){const ja=prim.getAttribute("JOINTS_0"),wa=prim.getAttribute("WEIGHTS_0");if(!ja||!wa)continue;const rawJ=ja.getArray() as Uint8Array|Uint16Array, rawW=wa.getArray() as ArrayLike<number>, mapped=new (rawJ.constructor as any)(rawJ.length);for(let v=0;v<ja.getCount();v++)for(let c=0;c<4;c++){const old=rawJ[v*4+c],w=rawW[v*4+c];const next=remap.get(old);if(next===undefined&&w>1e-8)throw new Error(`Cannot prune weighted joint ${oldJoints[old]?.getName()}`);mapped[v*4+c]=next??0;}ja.setArray(mapped);}
for(const j of oldJoints)if(!kept.includes(j))skin.removeJoint(j);
const nodeMap=new Map(root.listNodes().map(n=>[n.getName(),n]));
const sourceWorld=new Map<Node,T.Matrix4>(); for(const n of root.listNodes())sourceWorld.set(n,new T.Matrix4().fromArray(n.getWorldMatrix() as number[]));
// Compute desired world TRS for all skeleton nodes. Uniform scale is baked into positions, never bone scales.
const newWorld=new Map<Node,T.Matrix4>(); const qR=new T.Quaternion().setFromRotationMatrix(rotation);
for(const j of skin.listJoints()){const old=sourceWorld.get(j)!;const oldPos=new T.Vector3().setFromMatrixPosition(old), oldRot=new T.Quaternion().setFromRotationMatrix(old);const pos=oldPos.applyMatrix4(N);const rot=qR.clone().multiply(oldRot);newWorld.set(j,new T.Matrix4().compose(pos,rot,new T.Vector3(1,1,1)));}
// Maintain complete parent hierarchy, setting local transforms relative to transformed parent; armature and mesh roots become identity.
for(const n of root.listNodes()){
 if(n===meshNode){n.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);continue;}
 if(!newWorld.has(n))continue;
 const parent=n.getParentNode(); const pWorld=parent&&newWorld.get(parent); let local=newWorld.get(n)!.clone();if(pWorld)local=pWorld.clone().invert().multiply(local);
 const pos=new T.Vector3(),quat=new T.Quaternion(),scl=new T.Vector3();local.decompose(pos,quat,scl);n.setTranslation(pos.toArray()).setRotation(quat.toArray()).setScale([1,1,1]);
}
// Armature node is structural only and must not retain transform.
for(const n of root.listNodes())if(n.getName()==="Armature")n.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
// Bake world mesh transform and N into geometry, remove UV/material bindings; transform positions/normals.
const meshWorld=sourceWorld.get(meshNode)!; const bake=N.clone().multiply(meshWorld); const rotOnly=new T.Matrix3().setFromMatrix4(rotation);
for(const m of root.listMeshes())for(const prim of m.listPrimitives()){
 const pos=prim.getAttribute("POSITION"), norm=prim.getAttribute("NORMAL"); if(!pos||!norm)throw new Error("Source primitive lacks position/normal");
 for(let i=0;i<pos.getCount();i++){const p=new T.Vector3(pos.getElement(i,[0,0,0])[0],pos.getElement(i,[0,0,0])[1],pos.getElement(i,[0,0,0])[2]).applyMatrix4(bake);pos.setElement(i,p.toArray()); const v=new T.Vector3(norm.getElement(i,[0,0,0])[0],norm.getElement(i,[0,0,0])[1],norm.getElement(i,[0,0,0])[2]).applyMatrix3(rotOnly).normalize();norm.setElement(i,v.toArray());}
 for(const semantic of ["TEXCOORD_0","TEXCOORD_1","COLOR_0","TANGENT"])prim.setAttribute(semantic,null); prim.setMaterial(null);
}
// Recompute inverse bind matrices from transformed joint world matrices.
const ibm=skin.getInverseBindMatrices(); if(!ibm)throw new Error("Source skin has no inverse bind matrices"); const ibmArray=new Float32Array(skin.listJoints().length*16);
skin.listJoints().forEach((j,i)=>{const mat=newWorld.get(j);if(!mat)throw new Error(`Missing transformed joint ${j.getName()}`);ibmArray.set(mat.clone().invert().toArray(),i*16);});ibm.setArray(ibmArray);
// Remove textures/materials from document and optimize.
for(const m of root.listMaterials())m.dispose(); for(const tex of root.listTextures())tex.dispose();
await doc.transform(weld(),reorder({encoder:MeshoptEncoder}),quantize({quantizePosition:16,quantizeNormal:8,quantizeWeight:8}),meshopt({encoder:MeshoptEncoder,level:"medium"}));
const temp=`${output}.candidate.glb`; await io.write(temp,doc);
import { execSync } from "node:child_process"; try { execSync(`npx vite-node tools/rig/validate.ts "${temp}"`,{stdio:"inherit"}); } catch { throw new Error("Candidate failed validation; original output was not promoted."); }
const {rename}=await import("node:fs/promises");await rename(temp,output);
console.log(`Wrote ${output}: ${root.listMeshes()[0]?.listPrimitives()[0]?.getAttribute("POSITION")?.getCount()} vertices, ${root.listSkins()[0]?.listJoints().length} joints`);
