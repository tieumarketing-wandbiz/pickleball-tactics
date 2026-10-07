import { strokeSide } from "../core/contact";
import * as THREE from "three";
import type { Player, Shot } from "../core/scenario";
import type { PlayerId } from "../core/constants";
import { textSprite } from "./court";
export class Players {
  group = new THREE.Group();
  markers = new Map<PlayerId, THREE.Group>();
  pickables: THREE.Object3D[] = [];
  private rigs = new Map<
    PlayerId,
    {
      arm: THREE.Mesh;
      forearm: THREE.Mesh;
      paddle: THREE.Group;
      face: THREE.Mesh;
      line: THREE.Line;
      contact: THREE.Mesh;
      captions: THREE.Sprite[];
    }
  >();
  constructor(scene: THREE.Scene, players: Player[]) {
    scene.add(this.group);
    const capsule = new THREE.CapsuleGeometry(0.2, 0.48, 6, 16);
    for (const p of players) {
      const marker = new THREE.Group();
      marker.userData.id = p.id;
      const color = p.id.startsWith("A") ? 0xf2a274 : 0x70d9c1;
      const body = new THREE.Mesh(
        capsule,
        new THREE.MeshStandardMaterial({ color, roughness: 0.42 }),
      );
      body.position.y = 0.48;
      body.castShadow = true;
      body.userData.id = p.id;
      marker.add(body);
      this.pickables.push(body);
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
      label.position.y = 1.26;
      label.userData.id = p.id;
      marker.add(label);
      this.pickables.push(label);
      const armMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.65,
      });
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 1, 8),
        armMaterial,
      );
      const forearm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1, 8),
        armMaterial,
      );
      const paddle = new THREE.Group();
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 32),
        new THREE.MeshStandardMaterial({
          color: 0x70d9c1,
          roughness: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      face.scale.y = 1.2;
      paddle.add(face);
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.012, 6, 32),
        new THREE.MeshStandardMaterial({ color: 0xdce8e0 }),
      );
      rim.scale.y = 1.2;
      paddle.add(rim);
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.12, 8),
        new THREE.MeshStandardMaterial({ color: 0x273c44 }),
      );
      grip.position.y = -0.18;
      paddle.add(grip);
      face.userData.id = p.id;
      this.pickables.push(face);
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
      marker.add(arm, forearm, paddle, line, contact);
      arm.visible =
        forearm.visible =
        paddle.visible =
        line.visible =
        contact.visible =
          false;
      this.rigs.set(p.id, {
        arm,
        forearm,
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
  }
  update(players: Player[]) {
    for (const p of players) this.markers.get(p.id)!.position.set(p.x, 0, p.z);
  }
  poseShot(shot: Shot | undefined, poses: Player[]) {
    const orient = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      const delta = b.clone().sub(a);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.scale.set(1, delta.length(), 1);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      );
    };
    for (const [id, rig] of this.rigs) {
      const on = shot?.hitter === id;
      rig.arm.visible =
        rig.forearm.visible =
        rig.paddle.visible =
        rig.contact.visible =
          on;
      rig.captions.forEach((s) => (s.visible = false));
      rig.line.visible = false;
      if (!on || !shot) continue;
      const p = poses.find((p) => p.id === id)!;
      const side = strokeSide(p, shot);
      const facing = id.startsWith("A") ? -1 : 1;
      const right = -facing * (p.hand === "left" ? -1 : 1);
      const shoulder = new THREE.Vector3(right * 0.18, 0.65, 0);
      const offset = new THREE.Vector3(
        shot.from.x - p.x,
        shot.from.y,
        shot.from.z - p.z,
      );
      const goal = offset.clone();
      const horizontal = Math.hypot(goal.x, goal.z);
      if (horizontal > 0.95) {
        goal.x *= 0.95 / horizontal;
        goal.z *= 0.95 / horizontal;
      }
      if (horizontal < 0.08) {
        goal.x = right * 0.3;
        goal.z = facing * 0.15;
      }
      rig.paddle.position.copy(goal);
      rig.paddle.rotation.set(
        shot.from.y < 0.25 ? Math.PI / 2 : 0,
        facing < 0 ? Math.PI : 0,
        0,
      );
      const gripPoint = new THREE.Vector3(0, -0.18, 0)
        .applyQuaternion(rig.paddle.quaternion)
        .add(goal);
      const elbow = shoulder.clone().lerp(gripPoint, 0.52);
      elbow.z -= facing * 0.08;
      elbow.y -= 0.1;
      orient(rig.arm, shoulder, elbow);
      orient(rig.forearm, elbow, gripPoint);

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
      rig.contact.position.set(offset.x, 0.075, offset.z);
      const pos = rig.line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      pos.setXYZ(0, 0, 0.075, 0);
      pos.setXYZ(1, offset.x, 0.075, offset.z);
      pos.needsUpdate = true;
      rig.line.geometry.computeBoundingSphere();
      rig.line.computeLineDistances();
      rig.line.visible = horizontal > 0.15;
    }
  }
  select(id: string) {
    for (const [key, m] of this.markers)
      m.getObjectByName("selection")!.visible = key === id;
  }
}
