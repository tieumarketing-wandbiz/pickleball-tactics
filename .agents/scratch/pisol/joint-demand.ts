import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Humanoid } from '../../../src/scene/humanoid';
import { DEFAULT_HEIGHT } from '../../../src/core/constants';
const bytes=readFileSync('public/models/male-rigged.glb');
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const actor=new Humanoid({scene:gltf.scene},'A'), paddle=new T.Group();
const p={id:'A1' as const,x:0,z:3.6,hand:'right' as const};
const type=(process.argv[2] ?? 'reset') as keyof typeof DEFAULT_HEIGHT;
const shot={hitter:p.id,type,from:{x:.4,y:DEFAULT_HEIGHT[type],z:3.2},to:{x:0,z:-4},apex:2};
const center=+(process.argv[3]??'.225');
for(let t=center-.025;t<=center+.025;t+=1/240){
 actor.pose(p,shot,t,paddle);
 const x=actor.bone('Hips').position;
 console.log(t.toFixed(4),[x.x,x.y,x.z].map(q=>q.toFixed(4)),actor.wristDemand['1'],paddle.quaternion.toArray().map(q=>q.toFixed(4)));
}
