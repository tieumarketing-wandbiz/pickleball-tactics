import * as T from "three";
import { SHUTTER_SECONDS } from "../core/render-clock";
import { COURT } from "../core/constants";
const SAMPLES = 4;
const CORNERS = [0,1,2,0,2,3] as const;
interface History { object: T.Object3D; p: T.Vector3; q: T.Quaternion; oldP: T.Vector3; oldQ: T.Quaternion; }
/** Four 180°-shutter samples, batched across players. Linear pose history is a cheap local
 * velocity estimate over 20.8ms, not four full rig solves or extra scene/shadow passes.
 * All geometries, materials, matrices and history storage are allocated once here. */
export class ShutterGhosts {
  readonly group = new T.Group();
  readonly paddle: T.InstancedMesh[] = [];
  readonly ball: T.InstancedMesh[] = [];
  readonly swoosh: T.Mesh;
  private histories: History[];
  private last: number | undefined;
  private p = new T.Vector3();
  private q = new T.Quaternion();
  private scale = new T.Vector3(1,1,1);
  private matrix = new T.Matrix4();
  private tip = new T.Vector3();
  private oldTip = new T.Vector3();
  private edge = new T.Vector3();
  private oldEdge = new T.Vector3();
  private positions: T.BufferAttribute;
  constructor(scene: T.Scene, paddles: readonly T.Object3D[], ball: T.Object3D) {
    this.group.name = "180-degree-shutter";
    const face = new T.PlaneGeometry(0.19,0.246), sphere = new T.SphereGeometry(COURT.ballRadius,12,8);
    this.histories = [...paddles, ball].map(object => ({ object, p: new T.Vector3(), q: new T.Quaternion(), oldP: new T.Vector3(), oldQ: new T.Quaternion() }));
    for (let age=0;age<SAMPLES;age++) {
      const opacity = 0.16 * (1-age/(SAMPLES+1));
      const material = new T.MeshBasicMaterial({ color: 0xc9ddab, transparent:true, opacity, depthWrite:false, side:T.DoubleSide });
      const p = new T.InstancedMesh(face,material,paddles.length);
      const b = new T.InstancedMesh(sphere,new T.MeshBasicMaterial({ color:0xeaff80, transparent:true, opacity, depthWrite:false }),1);
      for (const mesh of [p,b]) { mesh.count=0; mesh.castShadow=mesh.receiveShadow=false; mesh.frustumCulled=false; mesh.renderOrder=3; this.group.add(mesh); }
      this.paddle.push(p); this.ball.push(b);
    }
    const geometry = new T.BufferGeometry();
    this.positions = new T.BufferAttribute(new Float32Array(paddles.length*SAMPLES*6*3),3).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute("position",this.positions); geometry.setDrawRange(0,0);
    this.swoosh = new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xdcecb5,transparent:true,opacity:0.11,depthWrite:false,side:T.DoubleSide}));
    this.swoosh.frustumCulled=false; this.swoosh.renderOrder=3;
    this.group.add(this.swoosh); this.group.visible=false; scene.add(this.group);
  }
  clear() { this.last=undefined; this.group.visible=false; }
  update(time: number, playing: boolean) {
    if (!playing) { this.clear(); return; }
    const dt = this.last === undefined ? 0 : time-this.last;
    this.group.visible=dt>0 && dt<0.25;
    let vertices=0;
    for (let age=0;age<SAMPLES;age++) { this.paddle[age].count=0; this.ball[age].count=0; }
    for (let i=0;i<this.histories.length;i++) {
      const h=this.histories[i];
      h.object.updateWorldMatrix(true,false); h.object.matrixWorld.decompose(h.p,h.q,this.scale);
      const isBall=i===this.histories.length-1;
      const speed=dt>0 ? h.p.distanceTo(h.oldP)/dt : 0;
      if (this.group.visible && h.object.visible && h.object.parent?.visible !== false && speed>(isBall ? 0.3 : 0.12)) {
        this.tip.set(0,0.12,0).applyQuaternion(h.q).add(h.p);
        this.edge.set(0.055,0,0).applyQuaternion(h.q);
        for (let age=0;age<SAMPLES;age++) {
          const alpha=Math.max(0,1-SHUTTER_SECONDS*(age+1)/SAMPLES/dt);
          this.p.lerpVectors(h.oldP,h.p,alpha); this.q.slerpQuaternions(h.oldQ,h.q,alpha);
          this.matrix.compose(this.p,this.q,this.scale.set(1,1,1));
          const ghost=(isBall ? this.ball : this.paddle)[age];
          ghost.setMatrixAt(ghost.count++,this.matrix);
          if (!isBall && speed>3) {
            this.oldTip.set(0,0.12,0).applyQuaternion(this.q).add(this.p);
            this.oldEdge.set(0.055,0,0).applyQuaternion(this.q);
            // Two triangles between successive paddle-tip samples; one pooled ribbon draw.
            for (const corner of CORNERS) {
              const tip=corner<2 ? this.tip : this.oldTip, edge=corner<2 ? this.edge : this.oldEdge;
              const sign=corner===0 || corner===3 ? -1 : 1;
              this.positions.setXYZ(vertices++,tip.x+edge.x*sign,tip.y+edge.y*sign,tip.z+edge.z*sign);
            }
            this.tip.copy(this.oldTip); this.edge.copy(this.oldEdge);
          }
        }
      }
      h.oldP.copy(h.p); h.oldQ.copy(h.q);
    }
    for (let age=0;age<SAMPLES;age++) {
      this.paddle[age].instanceMatrix.needsUpdate=true; this.ball[age].instanceMatrix.needsUpdate=true;
    }
    this.positions.needsUpdate=true; this.swoosh.geometry.setDrawRange(0,vertices);
    this.group.visible=this.paddle[0].count+this.ball[0].count>0;
    this.last=time;
  }
}
