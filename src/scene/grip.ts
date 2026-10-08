import * as T from "three";
export const GRIP_RADIUS = 0.0235;
const diagonal = 0.28;
export function handGripBasis(sign: number) {
  const wrist = new T.Vector3(sign * 0.625, 1.105, 0.085);
  const knuckle = new T.Vector3(sign * 0.668, 1.045, 0.085);
  const length = knuckle.clone().sub(wrist).normalize();
  const across = new T.Vector3(0, 0, -sign);
  const normal = new T.Vector3().crossVectors(length, across).normalize();
  const tangent = length
    .clone()
    .multiplyScalar(Math.cos(diagonal))
    .addScaledVector(across, -Math.sin(diagonal));
  const shaft = length
    .clone()
    .multiplyScalar(Math.sin(diagonal))
    .addScaledVector(across, Math.cos(diagonal));
  const center = tangent
    .clone()
    .multiplyScalar(0.073)
    .addScaledVector(shaft, 0.012)
    .addScaledVector(normal, -GRIP_RADIUS);
  return { wrist, knuckle, length, across, normal, tangent, shaft, center };
}
export function gripFrame(
  sign: number,
  center: T.Vector3,
  axis: T.Vector3,
  shoulder: T.Vector3,
  fallback: T.Vector3,
) {
  const basis = handGripBasis(sign),
    h = axis.clone().normalize();
  const radial = shoulder.clone().sub(center);
  radial.addScaledVector(h, -radial.dot(h));
  if (radial.lengthSq() < 0.0001)
    radial.copy(fallback).addScaledVector(h, -fallback.dot(h));
  if (radial.lengthSq() < 0.0001) radial.set(0, 0, 1).addScaledVector(h, -h.z);
  radial.normalize();
  const tangent = new T.Vector3()
    .crossVectors(h, radial)
    .normalize()
    .multiplyScalar(sign);
  const up = h.clone().multiplyScalar(sign);
  const source = new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(basis.tangent, basis.shaft, basis.normal),
  );
  const target = new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().makeBasis(tangent, up, radial),
  );
  const rotation = target.multiply(source.invert());
  const offset = basis.center.clone().applyQuaternion(rotation);
  return { rotation, offset, wrist: center.clone().sub(offset) };
}
export function closeGripVertex(point: T.Vector3, sign: number) {
  const b = handGripBasis(sign),
    delta = point.clone().sub(b.wrist);
  if (point.x * sign < 0.55 || point.y > 1.16 || delta.length() > 0.22)
    return point.clone();
  const u = delta.dot(b.tangent),
    axial = delta.dot(b.shaft),
    depth = delta.dot(b.normal);
  const knuckle = 0.073;
  let curled = point.clone();
  if (u >= knuckle) {
    // Bend the finger surface continuously around the handle. Preserve its thickness
    // instead of flattening/clamping depth, which creates creases at the knuckles.
    const turn = Math.min((u - knuckle) / GRIP_RADIUS, Math.PI * 0.94);
    const radius = GRIP_RADIUS + depth;
    curled = b.wrist
      .clone()
      .addScaledVector(b.tangent, knuckle + radius * Math.sin(turn))
      .addScaledVector(b.shaft, axial)
      .addScaledVector(b.normal, -GRIP_RADIUS + radius * Math.cos(turn));
  }
  // The supplied mesh's thumb fans toward -z. Fold it across the opposing
  // face of the grip while leaving the thumb web continuous with the palm.
  if (point.z < 0.06 && point.y < 1.12) {
    const base = new T.Vector3(sign * 0.638, 1.085, 0.043);
    const source = new T.Vector3(-sign * 0.026, -0.038, -0.055).normalize();
    const target = b.tangent
      .clone()
      .multiplyScalar(0.048)
      .addScaledVector(b.shaft, -0.016)
      .addScaledVector(b.normal, -0.024)
      .normalize();
    const rotation = new T.Quaternion().setFromUnitVectors(source, target);
    const amount =
      T.MathUtils.smoothstep(0.06 - point.z, 0, 0.045) *
      (1 - T.MathUtils.smoothstep(point.x * sign, 0.64, 0.668));
    const bent = point.clone().sub(base).applyQuaternion(rotation).add(base);
    return curled.lerp(bent, amount);
  }
  return curled;
}
