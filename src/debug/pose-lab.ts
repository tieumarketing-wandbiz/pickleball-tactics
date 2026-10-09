// Dev-only: renders one humanoid at several stroke times from side/front/3-4 views.
// Query: ?type=serve&times=-0.45,-0.25,0,0.15,0.3&x=0.3&y=0.55&z=-0.35&hand=right&player=A1&px=0&pz=4.9&w=1600&h=900
import * as T from "three";
import { Humanoid, loadHumanoidRig } from "../scene/humanoid";
import { createPaddle } from "../scene/paddle";
import type { Shot } from "../core/scenario";
import type { PlayerId, ShotType } from "../core/constants";
import { DEFAULT_HEIGHT } from "../core/constants";
import { strokePreparation } from "../core/stroke-motion";
import { playerPose } from "../core/player-pose";

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const type = (q.get("type") ?? "serve") as ShotType | "idle";
const id = (q.get("player") ?? "A1") as PlayerId;
const prep = strokePreparation(type === "idle" ? "volley" : type);
const times = (q.get("times") ?? `${-prep},${-prep * 0.55},0,0.15,0.35,0.8`)
  .split(",")
  .map(Number);
const px = num("px", 0),
  pz = num("pz", 0);
const facing = id.startsWith("A") ? -1 : 1;
const player = {
  id,
  x: px,
  z: pz,
  hand: (q.get("hand") ?? "right") as "left" | "right",
};
const shot: Shot | undefined =
  type === "idle"
    ? undefined
    : {
        hitter: id,
        type,
        from: {
          x: px + num("x", 0.3) * -facing,
          y: num("y", DEFAULT_HEIGHT[type]),
          z: pz + num("z", -0.35) * -facing,
        },
        to: { x: px + num("tx", 0.3), z: num("tz", -6 * -facing) },
        apex: 2,
      };
const W = num("w", 1600),
  H = num("h", 900);
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(W, H);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0x1b262c);
scene.add(new T.HemisphereLight(0xffffff, 0x334455, 2.2));
const sun = new T.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 6, 4);
scene.add(sun);
const marker = new T.Group();
marker.position.set(px, 0, pz);
scene.add(marker);
const grid = new T.GridHelper(6, 12, 0x557788, 0x334455);
grid.position.set(px, 0.001, pz);
scene.add(grid);
for (const y of [0.45, 0.6, 0.95, 1.6, 1.9]) {
  // reference heights: contact band, waist(pelvis), head band
  const line = new T.Mesh(
    new T.BoxGeometry(3, 0.004, 0.004),
    new T.MeshBasicMaterial({ color: y === 0.95 ? 0xff6666 : 0x66aaff }),
  );
  line.position.set(px, y, pz + 0.9);
  scene.add(line);
}
if (shot) {
  const ball = new T.Mesh(
    new T.SphereGeometry(0.037, 16, 8),
    new T.MeshBasicMaterial({ color: 0xddf094 }),
  );
  ball.position.set(shot.from.x, shot.from.y, shot.from.z);
  scene.add(ball);
}
const { group: paddle } = createPaddle();
const capsules = new T.Group();
marker.add(capsules);
marker.add(paddle);
const zoom = num("zoom", 1),
  lookY = num("look", 0.95);
const ALL_VIEWS: Record<string, T.Vector3> = {
  side: new T.Vector3(3.2, 1.0, 0),
  front: new T.Vector3(0, 1.0, -3.2 * -facing),
  top: new T.Vector3(0.001, 4.2, 0),
  back: new T.Vector3(0, 1.4, 3.2 * -facing),
  "3/4": new T.Vector3(2.3, 1.6, 2.3 * -facing),
  "f3/4": new T.Vector3(2.0, 1.4, -2.3 * -facing),
};
const views: [string, T.Vector3][] = (q.get("views") ?? "side,front,3/4")
  .split(",")
  .map((n) => [n, ALL_VIEWS[n]]);
const camera = new T.PerspectiveCamera(32, 1, 0.1, 50);
loadHumanoidRig().then((template) => {
  const actor = new Humanoid(template, id.startsWith("A") ? "A" : "B");
  marker.add(actor.root);
  const cw = W / times.length,
    ch = H / views.length;
  const labels = document.getElementById("labels")!;
  times.forEach((time, c) => {
    actor.pose(player, shot, time, paddle);
    const MAP: Record<string, string> = {
      pelvis: "Hips",
      handR: "RightHand",
      handL: "LeftHand",
      upperR: "RightArm",
      upperL: "LeftArm",
      lowerR: "RightForeArm",
      lowerL: "LeftForeArm",
      thighR: "RightUpLeg",
      thighL: "LeftUpLeg",
      shinR: "RightLeg",
      shinL: "LeftLeg",
      footR: "RightFoot",
      footL: "LeftFoot",
    };
    const bone = (n: string) =>
      actor.bone(MAP[n] ?? n).getWorldPosition(new T.Vector3());
    const pelvis = bone("pelvis"),
      hand = bone(player.hand === "left" ? "handL" : "handR"),
      head = paddle.localToWorld(new T.Vector3(0, 0.12, 0)),
      center = paddle.getWorldPosition(new T.Vector3());
    const elbow = (s: string) => {
      const a = bone("upper" + s),
        b = bone("lower" + s),
        c = bone("hand" + s);
      return (a.sub(b).angleTo(c.sub(b)) * 180) / Math.PI;
    };
    const knee = (s: string) => {
      const a = bone("thigh" + s),
        b = bone("shin" + s),
        c = bone("foot" + s);
      return 180 - (a.sub(b).angleTo(c.sub(b)) * 180) / Math.PI;
    };
    const target = playerPose(player, shot, time);
    const faceError =
      (new T.Vector3(0, 0, 1)
        .applyEuler(
          new T.Euler(target.paddlePitch, target.paddleYaw, target.paddleRoll, "YXZ"),
        )
        .angleTo(new T.Vector3(0, 0, 1).applyQuaternion(paddle.quaternion)) *
        180) /
      Math.PI;
    const ball = shot
      ? new T.Vector3(shot.from.x, shot.from.y, shot.from.z)
      : center;
    const metrics = `pelvis ${pelvis.y.toFixed(2)} hand ${hand.y.toFixed(2)} paddle ${center.y.toFixed(2)} headY-hand ${(head.y - hand.y).toFixed(2)}
miss ${center.distanceTo(ball).toFixed(2)} face° ${faceError.toFixed(0)} elbowL/R ${elbow("L").toFixed(0)}/${elbow("R").toFixed(0)} kneeL/R ${knee("L").toFixed(0)}/${knee("R").toFixed(0)}`;
    console.log(`t=${time} ${metrics}`);
    // torso capsules (wireframe) for the clearance debug
    capsules.clear();
    if (q.has("caps"))
      for (const c of actor.torsoCapsules) {
        const len = c.a.distanceTo(c.b);
        const mesh = new T.Mesh(
          new T.CapsuleGeometry(c.radius, len, 4, 12),
          new T.MeshBasicMaterial({ color: 0x55ff99, wireframe: true }),
        );
        mesh.scale.z = 1 / c.squash;
        const yAxis = c.b.clone().sub(c.a).normalize();
        mesh.quaternion.setFromRotationMatrix(
          new T.Matrix4().makeBasis(
            yAxis.clone().cross(c.front).normalize().negate(),
            yAxis,
            c.front,
          ),
        );
        mesh.position.copy(c.a).lerp(c.b, 0.5);
        capsules.add(mesh);
      }
    views.forEach(([name, offset], r) => {
      camera.aspect = cw / ch;
      camera.position.set(
        pelvis.x + offset.x / zoom,
        lookY + (offset.y - lookY) / zoom,
        pelvis.z + offset.z / zoom,
      );
      camera.lookAt(pelvis.x, lookY, pelvis.z);
      camera.updateProjectionMatrix();
      const x = c * cw,
        y = H - (r + 1) * ch;
      renderer.setViewport(x, y, cw, ch);
      renderer.setScissor(x, y, cw, ch);
      renderer.render(scene, camera);
      const label = document.createElement("div");
      label.style.left = `${x}px`;
      label.style.top = `${r * ch}px`;
      label.textContent = `${type} t=${time} ${name}`;
      if (r === 0)
        label.innerText += `
${metrics}`;
      labels.appendChild(label);
    });
  });
  document.title = "ready";
});
