import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Humanoid } from '../../../src/scene/humanoid';
import { DEFAULT_HEIGHT } from '../../../src/core/constants';
import { BodyVolume,makeArmSamples,sampleArm } from '../../../src/scene/body-volume';
const bytes=readFileSync('public/models/male-rigged.glb');
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const actor=new Humanoid({scene:gltf.scene},'A'), paddle=new T.Group(),rest=new Map<string,T.Quaternion>();
const pos=(n:string)=>actor.bone(n).getWorldPosition(new T.Vector3());
const rot=(n:string)=>actor.bone(n).getWorldQuaternion(new T.Quaternion());
actor.root.updateMatrixWorld(true);for(const [n]of actor.bones)rest.set(n,rot(n));
const p={id:'A1' as const,x:0,z:3.6,hand:'right' as const};
const type=(process.argv[2]??'lob') as keyof typeof DEFAULT_HEIGHT;
const shot={hitter:p.id,type,from:{x:.4,y:DEFAULT_HEIGHT[type],z:3.2},to:{x:0,z:-4},apex:2};
actor.pose(p,shot,+(process.argv[3]??'-.24'),paddle);
console.log('head',new T.Vector3(0,1,0).applyQuaternion(paddle.quaternion).toArray(),'face',new T.Vector3(0,0,1).applyQuaternion(paddle.quaternion).toArray());
const body=new BodyVolume(),samples=makeArmSamples();
body.update(s=>pos(s.bone),s=>rot(s.bone).multiply(rest.get(s.bone)!.clone().invert()),[[pos('LeftUpLeg'),pos('LeftLeg')],[pos('RightUpLeg'),pos('RightLeg')]]);
console.log('hips',pos('Hips').toArray(),'chest',pos('Spine2').toArray(),'feet',pos('LeftFoot').toArray(),pos('RightFoot').toArray());
for(const side of ['Left','Right']){
 const s=pos(side+'Arm'),e=pos(side+'ForeArm'),w=pos(side+'Hand');sampleArm(s,e,w,samples);
 console.log(side,s.toArray(),e.toArray(),w.toArray(),'palm',actor.palm(side as 'Left'|'Right').toArray());
 samples.points.forEach((p,i)=>{const gap=body.gap(p)-samples.radii[i];if(gap<.03){const n=new T.Vector3();body.gap(p,n);console.log(i,'gap',gap.toFixed(4),'p',p.toArray(),'normal',n.toArray());}});
}
