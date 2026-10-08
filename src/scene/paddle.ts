import * as T from "three";
export const PADDLE_GRIP_Y = -0.255;
export const PADDLE_SUPPORT_OFFSET = 0.075;
const HANDLE_CENTER_Y = -0.223;
export function createPaddle() {
  const group = new T.Group(),
    w = 0.19,
    h = 0.246,
    r = 0.045;
  const shape = new T.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const edge = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 8,
    }),
    new T.MeshStandardMaterial({ color: 0xc5d4d5, roughness: 0.55 }),
  );
  edge.position.z = -0.007;
  group.add(edge);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#17242c";
  c.fillRect(0, 0, 512, 640);
  c.lineWidth = 3;
  for (let i = -640; i < 1152; i += 12) {
    c.strokeStyle = i % 24 ? "#263944" : "#1d303b";
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i - 640, 640);
    c.stroke();
  }
  c.fillStyle = "#ddf094";
  c.fillRect(58, 84, 8, 270);
  c.font = "700 43px Helvetica,Arial,sans-serif";
  c.textAlign = "center";
  c.fillText("C", 256, 288);
  c.font = "600 18px Helvetica,Arial,sans-serif";
  c.fillStyle = "#e1ebe5";
  c.fillText("COURTSIDE", 256, 328);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const surface = new T.ShapeGeometry(shape, 12),
    position = surface.getAttribute("position"),
    uv = surface.getAttribute("uv") as T.BufferAttribute;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, position.getX(i) / w + 0.5, position.getY(i) / h + 0.5);
  const material = new T.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.8,
    side: T.DoubleSide,
  });
  const face = new T.Mesh(surface, material);
  face.position.z = 0.0095;
  group.add(face);
  const back = new T.Mesh(surface, material);
  back.position.z = -0.0095;
  group.add(back);
  const neck = new T.Mesh(
    new T.BoxGeometry(0.048, 0.045, 0.014),
    new T.MeshStandardMaterial({ color: 0x25333d, roughness: 0.6 }),
  );
  neck.position.y = -0.14;
  group.add(neck);
  const wrap = document.createElement("canvas");
  wrap.width = 64;
  wrap.height = 256;
  const wc = wrap.getContext("2d")!;
  wc.fillStyle = "#202a32";
  wc.fillRect(0, 0, 64, 256);
  wc.strokeStyle = "#46525b";
  wc.lineWidth = 3;
  for (let y = -30; y < 280; y += 25) {
    wc.beginPath();
    wc.moveTo(0, y);
    wc.lineTo(64, y + 18);
    wc.stroke();
  }
  const wrapTexture = new T.CanvasTexture(wrap);
  wrapTexture.colorSpace = T.SRGBColorSpace;
  const handle = new T.Mesh(
    new T.CylinderGeometry(0.0175, 0.0185, 0.158, 8),
    new T.MeshStandardMaterial({ map: wrapTexture, roughness: 0.95 }),
  );
  handle.position.y = HANDLE_CENTER_Y;
  group.add(handle);
  const cap = new T.Mesh(
    new T.CylinderGeometry(0.022, 0.022, 0.011, 12),
    new T.MeshStandardMaterial({ color: 0xe1e8df, roughness: 0.6 }),
  );
  cap.position.y = -0.307;
  group.add(cap);
  return { group, face, edge };
}
