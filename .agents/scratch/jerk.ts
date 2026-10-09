import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { playerPose } from '../../src/core/player-pose';
import { SHOT_TYPES, DEFAULT_HEIGHT } from '../../src/core/constants';
import { strokePreparation, STROKE_MOTION } from '../../src/core/stroke-motion';
import { Humanoid } from '../../src/scene/humanoid';
import { auditMotion } from '../../src/debug/motion-audit';
import type { Player, Shot } from '../../src/core/scenario';
const p: Player = {id:'A1',x:0,z:4,hand:'right'};
const bytes=readFileSync('public/models/male-rigged.glb');
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const actor=new Humanoid({scene:gltf.scene},'A'), paddle=new T.Group();
actor.root.position.set(p.x,0,p.z);
const rigPoints=()=>Object.fromEntries(['Hips','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftLeg','RightLeg','LeftFoot','RightFoot'].map(n=>[n,actor.bone(n).getWorldPosition(new T.Vector3())]));
for(const type of SHOT_TYPES){
 const shot:Shot={hitter:'A1',type,from:{x:.4,y:DEFAULT_HEIGHT[type],z:3.6},to:{x:0,z:-4},apex:2};
 const prep=strokePreparation(type);
 const core=auditMotion(t=>{const q=playerPose(p,shot,t,prep);return {paddle:q.paddle,hip:q.hip,footL:{x:q.feet.L.x,y:q.feet.L.lift,z:q.feet.L.z},footR:{x:q.feet.R.x,y:q.feet.R.lift,z:q.feet.R.z}};},-prep-.1,STROKE_MOTION[type].recover+.1);
 const rig=process.argv.includes('--core')?undefined:auditMotion(t=>{actor.pose(p,shot,t,paddle,undefined,prep);return {paddle:paddle.position.clone(),...rigPoints()};},-prep-.1,STROKE_MOTION[type].recover+.1);
 const format=(a:any)=>Object.entries(a.jumps).map(([n,q]:any)=>`${n}=${q.value.toFixed(3)}@${q.time.toFixed(3)}`).join(' ');
 console.log(`${type.padEnd(8)} core ${format(core)} peak=${core.peakSpeed.toFixed(2)}@${core.peakTime.toFixed(3)}`);
 if(rig)console.log(`         RIG ${format(rig)} peak=${rig.peakSpeed.toFixed(2)}@${rig.peakTime.toFixed(3)}`);
}
