import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Humanoid } from '../../../src/scene/humanoid';
import { DEFAULT_HEIGHT, DEFAULT_APEX, SHOT_TYPES } from '../../../src/core/constants';
import { STROKE_MOTION, strokePreparation } from '../../../src/core/stroke-motion';
import type { Player, Shot } from '../../../src/core/scenario';
await MeshoptDecoder.ready;
const bytes=fs.readFileSync('public/models/male-rigged.glb');
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const actor=new Humanoid({scene:gltf.scene},'A'), paddle=new T.Group();
actor.root.updateMatrixWorld(true);
const rest=new Map([...actor.bones].map(([name,b])=>[name,{position:b.position.clone(),scale:b.scale.clone(),length:b.parent?.isObject3D ? b.getWorldPosition(new T.Vector3()).distanceTo(b.parent.getWorldPosition(new T.Vector3())) : 0}]));
const torso=['Hips','Spine','Spine1','Spine2','Neck'];
const point=(n:string)=>actor.bones.get(n)!.getWorldPosition(new T.Vector3());
const chain=()=>torso.slice(1).reduce((sum,n,i)=>sum+point(n).distanceTo(point(torso[i])),0);
const torsoRest=chain();
const p:Player={id:'A1',hand:'right',x:0,z:3.6};
let maxLength=0,maxTorso=0,maxScale=0,worst='';
for(const type of SHOT_TYPES){
 const shot:Shot={hitter:'A1',type,from:{x:.4,y:DEFAULT_HEIGHT[type],z:3.2},to:{x:0,z:-4},apex:DEFAULT_APEX[type]};
 for(let t=-strokePreparation(type);t<=STROKE_MOTION[type].recover+.025;t+=.025){
  actor.pose(p,shot,t,paddle); actor.root.updateMatrixWorld(true);
  maxTorso=Math.max(maxTorso,Math.abs(chain()-torsoRest));
  for(const [name,b] of actor.bones){const r=rest.get(name)!;
   if(name==='Hips')continue;
   const delta=Math.abs(b.getWorldPosition(new T.Vector3()).distanceTo(b.parent!.getWorldPosition(new T.Vector3()))-r.length);
   if(delta>maxLength){maxLength=delta;worst=`${type} t=${t.toFixed(4)} ${name}`;}
   maxScale=Math.max(maxScale,b.scale.distanceTo(r.scale));
  }
 }
}
actor.pose(p,undefined,undefined,paddle);
console.log(JSON.stringify({maxBoneLengthErrorMetres:maxLength,maxTorsoChainErrorMetres:maxTorso,maxScaleError:maxScale,worst,restTorsoChainMetres:torsoRest,readyHeadJointY:point('Head').y},null,2));
