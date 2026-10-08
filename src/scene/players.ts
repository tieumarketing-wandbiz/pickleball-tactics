import { strokeSide } from "../core/contact";
import { Humanoid, loadHumanoidGeometry } from "./humanoid";
import * as THREE from "three";
import type { Player, Shot } from "../core/scenario";
import type { PlayerId } from "../core/constants";
import { SHOT_NAMES } from "../core/constants";
import { textSprite } from "./court";
import { createPaddle } from "./paddle";
export class Players {
  group = new THREE.Group();
  markers = new Map<PlayerId, THREE.Group>();
  pickables: THREE.Object3D[] = [];
  ready: Promise<void>;
  private lastPose?: {
    shot?: Shot;
    poses: Player[];
    time?: number;
    preparation?: number;
    continuation?: { shot: Shot; time: number; preparation?: number };
  };
  private motionFrame?: { clock: number; poses: Player[] };
  private shotBubble: THREE.Sprite;
  private shotBubbleCanvas: HTMLCanvasElement;
  private shotBubbleContext: CanvasRenderingContext2D;
  private shotBubbleTexture: THREE.CanvasTexture;
  private shotBubbleText = "";
  private rigs = new Map<
    PlayerId,
    {
      actor?: Humanoid;
      label: THREE.Sprite;
      paddle: THREE.Group;
      face: THREE.Mesh;
      line: THREE.Line;
      contact: THREE.Mesh;
      captions: THREE.Sprite[];
    }
  >();
  constructor(scene: THREE.Scene, players: Player[]) {
    scene.add(this.group);
    this.shotBubbleCanvas = document.createElement("canvas");
    this.shotBubbleCanvas.width = 512;
    this.shotBubbleCanvas.height = 176;
    this.shotBubbleContext = this.shotBubbleCanvas.getContext("2d")!;
    this.shotBubbleTexture = new THREE.CanvasTexture(this.shotBubbleCanvas);
    this.shotBubbleTexture.colorSpace = THREE.SRGBColorSpace;
    this.shotBubble = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.shotBubbleTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.shotBubble.renderOrder = 5;
    this.shotBubble.visible = false;
    this.group.add(this.shotBubble);
    for (const p of players) {
      const marker = new THREE.Group();
      marker.userData.id = p.id;
      const color = p.id.startsWith("A") ? 0xf2a274 : 0x70d9c1;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.04, 32),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.9,
          transparent: true,
          opacity: 0.35,
        }),
      );
      base.position.y = 0.04;
      base.userData.id = p.id;
      this.pickables.push(base);
      marker.add(base);
      const facing = p.id.startsWith("A") ? -1 : 1;
      marker.add(
        new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, facing),
          new THREE.Vector3(0, 0.07, 0),
          0.65,
          color,
          0.16,
          0.1,
        ),
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.38, 0.43, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffe596,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.064;
      ring.name = "selection";
      marker.add(ring);
      const label = textSprite(
        p.id,
        p.id.startsWith("A") ? "#ffd2b5" : "#a5f0df",
        0.42,
      );
      label.position.y = 1.95;
      label.userData.id = p.id;
      marker.add(label);
      this.pickables.push(label);
      const { group: paddle, face, edge } = createPaddle();
      for (const mesh of [face, edge]) {
        mesh.userData.id = p.id;
        this.pickables.push(mesh);
      }
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const line = new THREE.Line(
        lineGeometry,
        new THREE.LineDashedMaterial({
          color: 0xeee795,
          dashSize: 0.1,
          gapSize: 0.06,
          transparent: true,
          opacity: 0.65,
        }),
      );
      const contact = new THREE.Mesh(
        new THREE.RingGeometry(0.11, 0.14, 32),
        new THREE.MeshBasicMaterial({
          color: 0xeee795,
          side: THREE.DoubleSide,
        }),
      );
      contact.rotation.x = -Math.PI / 2;
      const captions = [
        textSprite("FH", "#70d9c1", 0.27),
        textSprite("BH", "#c8adff", 0.27),
        textSprite("—", "#ddf094", 0.27),
      ];
      for (const caption of captions) {
        caption.position.y = 1.56;
        caption.visible = false;
        marker.add(caption);
      }
      marker.add(paddle, line, contact);
      paddle.visible = line.visible = contact.visible = false;
      this.rigs.set(p.id, {
        label,
        paddle,
        face,
        line,
        contact,
        captions,
      });
      this.group.add(marker);
      this.markers.set(p.id, marker);
    }
    this.update(players);
    this.ready = loadHumanoidGeometry().then((geometry) => {
      for (const [id, rig] of this.rigs) {
        rig.actor = new Humanoid(geometry, id.startsWith("A") ? "A" : "B");
        rig.actor.mesh.userData.id = id;
        this.markers.get(id)!.add(rig.actor.mesh);
        this.pickables.push(rig.actor.mesh);
      }
      geometry.dispose();
      if (this.lastPose)
        this.poseShot(
          this.lastPose.shot,
          this.lastPose.poses,
          this.lastPose.time,
          undefined,
          this.lastPose.preparation,
          this.lastPose.continuation,
        );
    });
  }
  update(players: Player[]) {
    for (const p of players) this.markers.get(p.id)!.position.set(p.x, 0, p.z);
  }
  poseShot(
    shot: Shot | undefined,
    poses: Player[],
    swingTime?: number,
    clock?: number,
    preparation?: number,
    continuation?: { shot: Shot; time: number; preparation?: number },
  ) {
    this.lastPose = { shot, poses, time: swingTime, preparation, continuation };
    const hitter = shot && poses.find((p) => p.id === shot.hitter);
    this.shotBubble.visible = !!shot && !!hitter;
    if (shot && hitter && SHOT_NAMES[shot.type] !== this.shotBubbleText) {
      this.drawShotBubble(SHOT_NAMES[shot.type]);
      this.shotBubbleText = SHOT_NAMES[shot.type];
    }
    const dt =
      clock !== undefined && this.motionFrame
        ? Math.max(0.001, Math.min(0.1, clock - this.motionFrame.clock))
        : 1 / 60;
    for (const [id, rig] of this.rigs) {
      const p = poses.find((p) => p.id === id)!;
      const on = shot?.hitter === id;
      const previous = this.motionFrame?.poses.find((q) => q.id === id);
      const movement =
        clock !== undefined
          ? {
              clock,
              dt,
              velocity: previous
                ? new THREE.Vector3(
                    (p.x - previous.x) / dt,
                    0,
                    (p.z - previous.z) / dt,
                  )
                : new THREE.Vector3(),
            }
          : undefined;
      const continuing =
        !on && continuation?.shot.hitter === id ? continuation : undefined;
      const head =
        rig.actor?.pose(
          p,
          on ? shot : continuing?.shot,
          on ? swingTime : continuing?.time,
          rig.paddle,
          movement,
          on ? preparation : continuing?.preparation,
        ) ?? new THREE.Vector3(0, 1.7, 0);
      rig.label.position.copy(head).add(new THREE.Vector3(0, 0.17, 0));
      rig.captions.forEach((s) => {
        s.visible = false;
        s.position.copy(head).add(new THREE.Vector3(0, 0.39, 0));
      });
      rig.paddle.visible = true;
      rig.contact.visible = on;
      rig.line.visible = false;
      if (!on || !shot) continue;
      const side = strokeSide(p, shot);
      this.shotBubble.position.set(p.x + head.x, head.y + 0.76, p.z + head.z);
      const color =
        side.kind === "forehand"
          ? 0x70d9c1
          : side.kind === "backhand"
            ? 0xc8adff
            : 0xddf094;
      (rig.face.material as THREE.MeshStandardMaterial).color.setHex(color);
      rig.captions[
        side.kind === "forehand" ? 0 : side.kind === "backhand" ? 1 : 2
      ].visible = true;
      const offset = new THREE.Vector3(
        shot.from.x - p.x,
        shot.from.y,
        shot.from.z - p.z,
      );
      rig.contact.position.set(offset.x, 0.075, offset.z);
      const pos = rig.line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      pos.setXYZ(0, 0, 0.075, 0);
      pos.setXYZ(1, offset.x, 0.075, offset.z);
      pos.needsUpdate = true;
      rig.line.geometry.computeBoundingSphere();
      rig.line.computeLineDistances();
      rig.line.visible = Math.hypot(offset.x, offset.z) > 0.15;
    }
    this.motionFrame =
      clock !== undefined
        ? { clock, poses: poses.map((p) => ({ ...p })) }
        : undefined;
  }
  select(id: string) {
    for (const [key, m] of this.markers)
      m.getObjectByName("selection")!.visible = key === id;
  }

  private drawShotBubble(name: string) {
    const ctx = this.shotBubbleContext;
    ctx.clearRect(
      0,
      0,
      this.shotBubbleCanvas.width,
      this.shotBubbleCanvas.height,
    );
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.roundRect(14, 10, 484, 126, 34);
    ctx.moveTo(238, 130);
    ctx.lineTo(256, 165);
    ctx.lineTo(274, 130);
    ctx.closePath();
    ctx.fillStyle = "#172b32";
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(14, 10, 484, 126, 34);
    ctx.strokeStyle = "#ddf094";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#ddf094";
    ctx.beginPath();
    ctx.arc(53, 73, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2f3e7";
    ctx.font = "700 58px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 270, 74, 390);
    const width = THREE.MathUtils.clamp(
      (ctx.measureText(name).width + 116) / 220,
      1.45,
      2.35,
    );
    this.shotBubble.scale.set(width, (width * 176) / 512, 1);
    this.shotBubbleTexture.needsUpdate = true;
  }
}
