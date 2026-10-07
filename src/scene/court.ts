import * as THREE from "three";
import { COURT, netHeight } from "../core/constants";
export function textSprite(
  text: string,
  color = "#d8e6e6",
  size = 0.6,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = "600 64px system-ui";
  canvas.width = Math.ceil(measure.measureText(text).width + 32);
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 64px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
  );
  sprite.scale.set((size * canvas.width) / 96, size, 1);
  return sprite;
}
export function createCourt(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);
  const material = (color: number) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const plane = (
    w: number,
    h: number,
    x: number,
    z: number,
    mat: THREE.Material,
    y = 0.01,
  ) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.18, 18.3),
    material(0x243b3e),
  );
  base.position.y = -0.1;
  base.receiveShadow = true;
  group.add(base);
  plane(6.1, 13.41, 0, 0, material(0x237e82));
  const kitchenMaterial = material(0x2c666d);
  plane(6.1, 4.26, 0, 0, kitchenMaterial, 0.014);
  const white = material(0xd4e9df);
  const line = 0.05;
  // Outer edges coincide with regulation bounds; all paint sits inside them.
  for (const x of [-COURT.halfWidth + line / 2, COURT.halfWidth - line / 2])
    plane(line, 13.41, x, 0, white, 0.018);
  for (const z of [
    -COURT.halfLength + line / 2,
    COURT.halfLength - line / 2,
    -COURT.kitchen + line / 2,
    COURT.kitchen - line / 2,
  ])
    plane(6.1, line, 0, z, white, 0.019);
  for (const sign of [-1, 1])
    plane(
      line,
      COURT.halfLength - COURT.kitchen,
      0,
      (sign * (COURT.halfLength + COURT.kitchen)) / 2,
      white,
      0.02,
    );
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0xf4d26d,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const highlight = plane(6.0, 4.16, 0, 0, highlightMat, 0.023);
  highlight.visible = false;
  // Net silhouette and tape share the same sag profile used by the solver.
  const vertices: number[] = [],
    indices: number[] = [];
  const strips = 40;
  for (let i = 0; i <= strips; i++) {
    const x = -COURT.netHalfWidth + (2 * COURT.netHalfWidth * i) / strips;
    vertices.push(x, 0.04, 0, x, netHeight(x), 0);
    if (i < strips) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const netCanvas = document.createElement("canvas");
  netCanvas.width = 64;
  netCanvas.height = 64;
  const ctx = netCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = "#dae7de";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(netCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(95, 12);
  const uv: number[] = [];
  for (let i = 0; i <= strips; i++) uv.push(i / strips, 0, i / strips, 1);
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const net = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1,
    }),
  );
  group.add(net);
  const tapePoints = Array.from({ length: 41 }, (_, i) => {
    const x = -COURT.netHalfWidth + (2 * COURT.netHalfWidth * i) / 40;
    return new THREE.Vector3(x, netHeight(x), 0);
  });
  group.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(tapePoints),
        40,
        0.023,
        6,
        false,
      ),
      white,
    ),
  );
  for (const x of [-3.35, 3.35]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 1.04, 12),
      material(0x8aa8a7),
    );
    pole.position.set(x, 0.52, 0);
    pole.castShadow = true;
    group.add(pole);
  }
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, COURT.netCenter, 0.025),
    white,
  );
  strap.position.y = COURT.netCenter / 2;
  group.add(strap);
  // Court lettering is painted in world space, so it stays parallel to the net
  // as the camera rotates. Each half faces its own baseline.
  const lettering = document.createElement("canvas");
  lettering.width = 2048;
  lettering.height = 384;
  const letteringContext = lettering.getContext("2d")!;
  letteringContext.font = "700 230px Helvetica, Arial, sans-serif";
  letteringContext.fillStyle = "#e1eee3";
  letteringContext.textAlign = "center";
  letteringContext.textBaseline = "middle";
  letteringContext.fillText("PPA Xuân Lôi", 1024, 192);
  const letteringTexture = new THREE.CanvasTexture(lettering);
  letteringTexture.colorSpace = THREE.SRGBColorSpace;
  letteringTexture.anisotropy = 8;
  const letteringMaterial = new THREE.MeshBasicMaterial({
    map: letteringTexture,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const letteringGeometry = new THREE.PlaneGeometry(4.5, 0.9);
  for (const sign of [-1, 1]) {
    const label = new THREE.Mesh(letteringGeometry, letteringMaterial);
    label.name = `kitchen-lettering-${sign}`;
    label.rotation.set(-Math.PI / 2, 0, sign < 0 ? Math.PI : 0);
    label.position.set(0, 0.028, (sign * COURT.kitchen) / 2);
    group.add(label);
  }
  const ground = plane(200, 200, 0, 0, material(0x111e26), -0.015);
  // Subtle perimeter reference ticks keep the tactical model readable in perspective.
  const ticks = new THREE.Group();
  for (let z = -8; z <= 8; z++) {
    for (const x of [-4.3, 4.3]) {
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.012, 0.02),
        material(0x557078),
      );
      mark.position.set(x, 0.005, z);
      ticks.add(mark);
    }
  }
  group.add(ticks);
  return {
    group,
    ground,
    setKitchen: (on: boolean) => {
      highlight.visible = on;
    },
  };
}
