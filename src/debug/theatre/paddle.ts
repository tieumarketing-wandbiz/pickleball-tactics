// Procedural pickleball paddle for the Theatre.js demo.
// Frame: origin = grip centre on the handle axis, +Y = handle → head, +Z = forehand (palm-side)
// face normal. The two faces have different colours so the face orientation reads on screen.
import * as T from "three";

export const PADDLE = {
  butt: -0.05,
  throat: 0.075,
  top: 0.36,
  width: 0.19,
  thickness: 0.014,
  /** face centre along +Y (the "sweet spot") */
  faceCentre: 0.215,
};

function roundedRect(w: number, y0: number, y1: number, r: number) {
  const s = new T.Shape();
  const x0 = -w / 2,
    x1 = w / 2;
  // Slightly tapered throat, rounded top corners.
  const neck = 0.035;
  s.moveTo(-neck, y0);
  s.lineTo(neck, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + 0.05);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + 0.05);
  s.quadraticCurveTo(x0, y0, -neck, y0);
  return s;
}

export function createPaddle() {
  const g = new T.Group();
  g.name = "paddle";
  const P = PADDLE;
  const shape = roundedRect(P.width, P.throat - 0.01, P.top, 0.055);
  const core = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth: P.thickness,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 10,
    }),
    new T.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6 }),
  );
  core.position.z = -P.thickness / 2;
  g.add(core);
  const faceGeo = new T.ShapeGeometry(shape, 10);
  const fore = new T.Mesh(
    faceGeo,
    new T.MeshStandardMaterial({ color: 0xe0413a, roughness: 0.55 }),
  );
  fore.position.z = P.thickness / 2 + 0.0025;
  const back = new T.Mesh(
    faceGeo,
    new T.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.55, side: T.BackSide }),
  );
  back.position.z = -P.thickness / 2 - 0.0025;
  g.add(fore, back);
  // Handle: octagonal grip with a butt cap.
  const handleLen = P.throat - P.butt;
  const handle = new T.Mesh(
    new T.CylinderGeometry(0.0155, 0.0165, handleLen, 8),
    new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }),
  );
  handle.position.y = (P.throat + P.butt) / 2;
  const cap = new T.Mesh(
    new T.CylinderGeometry(0.019, 0.019, 0.008, 8),
    new T.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.4 }),
  );
  cap.position.y = P.butt - 0.002;
  g.add(handle, cap);
  g.traverse((o) => {
    if ((o as T.Mesh).isMesh) {
      o.castShadow = true;
    }
  });
  return g;
}
