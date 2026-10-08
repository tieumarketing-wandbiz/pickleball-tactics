import * as THREE from "three";
import { COURT } from "../core/constants";
import type { Point3 } from "../core/scenario";
import type { Trajectory } from "../core/trajectory";
export class BallView {
  ball: THREE.Mesh;
  path?: THREE.Mesh;
  bouncePath?: THREE.Line;
  target: THREE.Group;
  incomingPath?: THREE.Line;
  interceptMarker: THREE.Mesh;
  group = new THREE.Group();
  private spinTrajectory?: Trajectory;
  private baseOrientation = new THREE.Quaternion();
  private baseSpinAngle = 0;
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f4ef6a";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#306f71";
    ctx.fillRect(0, 54, 256, 18);
    ctx.fillStyle = "#526642";
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 10; col++) {
        ctx.beginPath();
        ctx.arc(col * 26 + (row % 2) * 13, row * 32 + 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(COURT.ballRadius, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        emissive: 0xc8c445,
        emissiveIntensity: 0.35,
        roughness: 0.7,
      }),
    );
    this.ball.castShadow = true;
    this.group.add(this.ball);
    // Small halo aids ball visibility at the overview without changing its physical radius.
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xf9ef95,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    halo.scale.set(0.15, 0.15, 0.15);
    this.ball.add(halo);
    this.target = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.21, 40),
      new THREE.MeshBasicMaterial({ color: 0xf5e889, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.target.add(ring);
    for (const angle of [0, Math.PI / 2]) {
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.008, 0.014),
        new THREE.MeshBasicMaterial({ color: 0xf5e889 }),
      );
      cross.rotation.y = angle;
      this.target.add(cross);
    }
    this.group.add(this.target);
    this.interceptMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshBasicMaterial({
        color: 0x70d9c1,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.interceptMarker.visible = false;
    this.group.add(this.interceptMarker);
    this.group.visible = false;
  }
  set(tr?: Trajectory) {
    if (this.bouncePath) {
      this.group.remove(this.bouncePath);
      this.bouncePath.geometry.dispose();
      (this.bouncePath.material as THREE.Material).dispose();
      this.bouncePath = undefined;
    }
    if (this.path) {
      this.group.remove(this.path);
      this.path.geometry.dispose();
      (this.path.material as THREE.Material).dispose();
      this.path = undefined;
    }
    this.group.visible = !!tr;
    if (!tr) return;
    const curve = new THREE.CatmullRomCurve3(
      tr.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    );
    this.path = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 120, 0.012, 6, false),
      new THREE.MeshBasicMaterial({
        color: tr.result === "OK" ? 0xe5e688 : 0xff8c7c,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.group.add(this.path);
    if (tr.bouncePoints.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        tr.bouncePoints.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      );
      this.bouncePath = new THREE.Line(
        geometry,
        new THREE.LineDashedMaterial({
          color: tr.bounceOut ? 0xffb78d : 0xe5e688,
          dashSize: 0.12,
          gapSize: 0.08,
          transparent: true,
          opacity: 0.6,
        }),
      );
      this.bouncePath.computeLineDistances();
      this.group.add(this.bouncePath);
    }
    this.target.position.set(tr.landing.x, 0.07, tr.landing.z);
    this.target.visible = tr.result !== "NET";
    this.at(tr, 0);
  }
  setIncoming(tr?: Trajectory, time?: number) {
    if (this.incomingPath) {
      this.group.remove(this.incomingPath);
      this.incomingPath.geometry.dispose();
      (this.incomingPath.material as THREE.Material).dispose();
      this.incomingPath = undefined;
    }
    this.interceptMarker.visible = !!tr && time !== undefined;
    if (!tr || time === undefined) return;
    const points = Array.from({ length: 101 }, (_, i) => {
      const p = tr.at((time * i) / 100);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    this.incomingPath = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: 0x70d9c1,
        dashSize: 0.12,
        gapSize: 0.07,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.incomingPath.computeLineDistances();
    this.group.add(this.incomingPath);
    const point = tr.at(time);
    this.interceptMarker.position.set(point.x, point.y, point.z);
  }
  setInterceptPoint(point?: Point3) {
    this.interceptMarker.visible = !!point;
    if (point) this.interceptMarker.position.set(point.x, point.y, point.z);
  }
  rotate(tr: Trajectory | undefined, time: number) {
    if (!tr) return;
    if (this.spinTrajectory !== tr) {
      this.baseOrientation.copy(this.ball.quaternion);
      this.spinTrajectory = tr;
      this.baseSpinAngle = tr.spinAngle(time);
    }
    this.ball.quaternion
      .setFromAxisAngle(
        new THREE.Vector3(tr.spinAxis.x, tr.spinAxis.y, tr.spinAxis.z),
        tr.spinAngle(time) - this.baseSpinAngle,
      )
      .multiply(this.baseOrientation);
  }
  at(tr: Trajectory, time: number) {
    const p = tr.at(time);
    this.ball.position.set(p.x, p.y, p.z);
    this.rotate(tr, time);
  }
}
