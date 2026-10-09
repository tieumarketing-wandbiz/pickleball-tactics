# Rig guide: Mixamo skeleton, IK-to-hierarchy runtime, weights

Audience: `sol` (Blender weight audit, Stage A) and `opus` (runtime retarget, Stage C). Written 2026-10-08.
Asset: `tools/rig/source/human-rig.glb` (read-only). Runtime: three r180. Blender: 5.2.2 LTS.

How the evidence is tagged:
- `[Rn]` is a web source. The URLs are in **Sources** at the end. Claims from sources are paraphrased.
- `[Ln]` is something verified locally in this session against the actual asset, three r180 source, or Blender 5.2.2 (see **Local verification**). Where a web source and a local check disagree, the local check wins.
- *Heuristic* marks starting values that come from practice and have no citation. Tune them visually.

---

## 0. Measured facts about THIS asset (read first) [L1][L3]

| Fact | Value | Consequence |
|---|---|---|
| Joints | 65 in `skins[0].joints`. 52 carry weight. 13 leaf bones carry none (`*4`, `*Toe_End`, `HeadTop_End`) | The 52 weighted bones match the standard Mixamo deform list [R7]. End bones are optional (see §9). |
| Hierarchy root | Scene root `Armature` (identity TRS) has two children: `mixamorig:Hips` and the skinned mesh node `tripo_node_…` | The mesh is a sibling of Hips and has no scale anywhere. Bone scales are 1 ± 3e-5. |
| Bone axis | For every bone, the first child's local translation is `(0, L, 0)`. **Local +Y points along the bone** | This is Blender's bone convention (Y along the bone, roll sets X/Z) carried into glTF [R8][R9]. |
| Facing | Toes point toward −X. Arms extend along ±Z. Character's **left = +Z** (glTF space) | The lateral (mirror) axis is **glTF Z**, which becomes **Blender Y** after import. See §5.6. |
| A-pose | Upper arm about 32° below horizontal. Elbow pre-bent about 16°. Knee pre-bent about 12° (shin angled backward). Elbow points backward (+X) | The rest pose already has valid bend directions to use as pole references. |
| Spine/hips frames | Hips/Spine local X = character left, local Y = up, local Z = forward | Forward bend is about local X, twist (yaw) about local Y, side bend about local Z, *for these bones only*. |
| Other bones' rolls | Arbitrary (Tripo-generated). Example: on `LeftHandIndex1` the anatomical curl axis lies about 50° between local X and local Z | **Never hard-code Euler axes for limbs or fingers.** Derive anatomical axes from rest geometry at load (§2.3). |
| L/R frames | Right frame = (−M·X_L, M·Y_L, M·Z_L), where M mirrors across Z | A rotation about **local X has the same sign** on both sides. Rotations about local **Y (twist) and Z flip sign**. |
| Skin | 5,087 verts (4,395 after welding UV-seam duplicates, then one manifold island). Influence histogram 1:1335, 2:2539, 3:690, 4:523. Weights are float and sum to 1 | Bone heat can run after merge-by-distance (single island). |
| Arm/torso mixing | 235 verts mix trunk (Spine*/Hips/Neck) with upper-arm weights. 123 of them are lateral (abs(z) > 0.08) and below armpit height (y < 0.78) | This is a likely cause of arms "sticking" to the torso. Audit these first (§5.3). |
| Symmetry | Mesh is *nearly* symmetric (mirror error median 0.22 mm, p95 2.2 mm, max 6.3 mm) | Blender's `vertex_group_mirror` mirrored **0 of 4,395** verts (position mode) and 228 (topology mode). Use the KD-tree mirror script in §5.6. |

---

## 1. Mixamo skeleton conventions

### 1.1 Hierarchy (52 deform bones + 13 end bones)
```
Hips
├─ Spine ─ Spine1 ─ Spine2
│   ├─ Neck ─ Head ─ HeadTop_End
│   ├─ LeftShoulder ─ LeftArm ─ LeftForeArm ─ LeftHand
│   │     └─ LeftHand{Thumb,Index,Middle,Ring,Pinky}1 ─ 2 ─ 3 ─ 4(end)
│   └─ RightShoulder ─ … (mirror)
├─ LeftUpLeg ─ LeftLeg ─ LeftFoot ─ LeftToeBase ─ LeftToe_End
└─ RightUpLeg ─ … (mirror)
```
- The Mixamo root is the **Hips** bone. There is no ground-level root bone, so pelvis translation is the character's motion. Some retargeting tools expect a root at the feet and need one added [R11]. Our runtime moves a wrapper `Object3D` instead.
- In this file every bone of a finger chain is a child of `*Hand` (Thumb1/Index1/… hang directly off the hand) [L1].
- "Left" means the character's own left [L1].

### 1.2 Local axes as they arrive in glTF/three
- Blender bones always point along local **+Y**. Roll only spins X/Z around Y [R8]. The Blender glTF importer's default "Blender (+Y)" heuristic places bone tips on local +Y [R9]. This asset confirms +Y along every bone [L1].
- Mixamo/Tripo **rolls are not standardized** across rigs. Retargeting by copying local rotations fails when rolls or rest orientations differ [R10]. That is why §2 drives bones from world-space *directions* plus rest data, not from copied Euler angles.
- Mirroring [L1]: X axes of left/right twins are negated mirror images, and Y and Z are plain mirror images. So a curl about local X is the same sign on both sides, while twist (Y) and local-Z rotations are sign-flipped. Even so, derive axes geometrically per side (§2.3) instead of relying on this.

### 1.3 Rest pose: A-pose vs T-pose
- A-pose usually deforms the shoulder better because the rest sits in the arm's mid range. The cost is extra weight painting, because the arms sit close to the torso and automatic weights bleed between them [R13]. T-pose aligns joints with the world axes and is what many auto-riggers and mocap expect [R13].
- Implications here:
  1. Bone-heat or nearest-bone weighting **cross-contaminates the inner arm and the side of the ribcage** (measured in §0). That causes "arms stick to torso".
  2. Any "zero" angle in our runtime is the A-pose. Express arm angles as *directions*, not as offsets from a T-pose.
  3. A useful Blender trick: weight in a temporary T-pose and transfer back by topology (§5.4).

### 1.4 End bones
- `HeadTop_End`, `*_End` and finger `*4` are leaf markers with no weights [L1]. They are handy for reading a bone's tip position (fingertip, head top), but nothing deforms with them.
- Blender's exporter can drop them with *Deform bones only* once they are marked non-deform (§5.8) [R34]. Pruning 65 → 52 bones has negligible GPU impact (§9).

### 1.5 Name mangling and robust matching
- three's `PropertyBinding.sanitizeNodeName` turns whitespace into `_` and **deletes** the characters `[ ] . : /` [R1][R2]. GLTFLoader applies it to every node name through `createUniqueName`, so `mixamorig:Hips` becomes **`mixamorigHips`** [L2][R3]. Mixamo animation tracks then report errors such as a missing `mixamorigRightUpLeg.quaternion` target [R4]. Third-party Mixamo maps in three.js use the sanitized form [R7].
- Mixamo itself ships prefix variants: `mixamorig:`, `mixamorig1:` (numbered) and `mixamorig_` (DAE export) [R5][R6].
- GLTFLoader r180 **keeps the original name in `object.userData.name`** (GLTFLoader.js about line 4417) [L2]. Duplicate names get a `_1` suffix [R3].
- Robust matcher, verified on this file [L4]:
```ts
const MIXAMO_PREFIX = /^mixamorig\d*[:_]?/i;
export const canonicalBoneName = (o: THREE.Object3D) =>
  String(o.userData?.name ?? o.name).replace(MIXAMO_PREFIX, '');   // "Hips", "LeftHandIndex1", …
export function collectBones(root: THREE.Object3D) {
  const map = new Map<string, THREE.Bone>();
  root.traverse(o => { if ((o as THREE.Bone).isBone) map.set(canonicalBoneName(o), o as THREE.Bone); });
  return map;   // assert that all 52 required names exist; fail loudly otherwise
}
```

### 1.6 Facing
- glTF's convention: right-handed, +Y up, **the asset's front faces +Z** [R12]. In three, `Object3D.lookAt` on a non-camera aims local **+Z** at the target [R48].
- This asset faces **−X**. Two options:
  - **(a) Keep the file as is** and parent the loaded scene under a wrapper with `wrapper.rotation.y = +π/2`. That maps −X to +Z (verified numerically [L4]).
  - **(b) Have `sol` rotate the rig in Blender** to face −Y (Blender front), which exports as glTF +Z.
- Decide once and record it on the board. Never rotate individual bones to fix facing.

---

## 2. Driving the hierarchy from world-space IK targets (three r180)

### 2.1 How three skins (what matters for correctness) [L2][R14][R15]
- `Skeleton.update()` computes `boneMatrices[i] = bone.matrixWorld × boneInverses[i]` and flags the bone texture. The renderer calls it **once per frame per skeleton** (WebGLObjects) [L2].
- `boneInverses` come from the glTF `inverseBindMatrices` [R47]. `Skeleton.calculateInverses()` **overwrites them from the bones' current `matrixWorld`** [L2][R15]. Calling it while posed makes that pose the new bind pose, and the mesh then shows its rest shape in that pose. **Never call it on a loaded glTF.**
- GLTFLoader binds every skinned mesh with an **identity bind matrix** [L2]. Default `bindMode = AttachedBindMode`: each frame `bindMatrixInverse = inverse(mesh.matrixWorld)`, which cancels the mesh's own model matrix. Only the bones' world matrices decide where vertices go [L2][R14]. `DetachedBindMode` uses the stored `bindMatrix` and is meant for skeletons shared across meshes [R14]. Keep **Attached**.
- Move, turn and scale the whole character only through the wrapper (uniform scale). Do not reparent the mesh or bones separately.
- `SkinnedMesh.normalizeSkinWeights()` exists as a load-time safety net [L2].
- Frustum culling: a SkinnedMesh's bounding sphere is computed **once**, lazily, from the pose at that moment (Frustum.js line 150) [L2]. For lunges near screen edges, set `frustumCulled = false` on the 4 players or recompute the sphere after a wide pose.

### 2.2 Libraries: when not to use them
- **CCDIKSolver** is iterative cyclic coordinate descent over `Skeleton.bones` indices, with per-link limits and an iteration count [R17]. It converges approximately and has no pole vector. It is wrong for a closed-form arm or leg where elbow and knee direction must be art-directed.
- **three-ik** is a FABRIK solver with ball constraints. It labels itself a work in progress with breaking changes [R18]. Same objection.
- **SkeletonUtils.retarget / retargetClip** map an *existing* animation from a source skeleton onto a target (bone-name map, hip handling, fps/trim) [R19]. We have no clips, so they don't apply. Copying rotations between skeletons with different rolls also breaks [R10].
- **SkeletonUtils.clone** **is** useful: it clones a skinned scene so the copy stays bound to its own bones while sharing geometry and material. Use it to spawn the 4 players from one loaded GLB [R19].
- Use the analytic two-bone IK [R20][R21] with the aim recipe below.

### 2.3 Core pattern: rest-calibrated anatomical frames (absolute every frame)
At load, in the rest pose, record for each driven bone:
- `axisL`: the bone direction in its own local space. This is the unit vector of the child's local position, about (0,1,0) here.
- `refL`: a second anatomical direction in local space, perpendicular to `axisL`. Examples: the elbow's bend-plane pole for the upper arm, the palm normal for the hand, the knee's forward for the thigh. Compute it from **rest world geometry** and bring it into local space with the inverse rest world rotation.
- `frameInv = inverse(basis(axisL, refL))`, where `basis(y, z)` builds the rotation whose +Y = y and +Z = z⊥.

Each frame, the solver produces a world direction `dirW` and a world reference `refW` for the bone. Then:
`qWorld = basis(dirW, refW) · frameInv`, and `bone.quaternion = inverse(parentWorldQ) · qWorld`.

This is an aim constraint with full twist control. It is **absolute**: computed from rest data every frame, never incremented. Error therefore cannot accumulate (1,000 repeated solves give 6e-8 m wrist error and unit scale [L4]).

```ts
// Module-level temporaries: zero allocations per frame.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Rotation whose +Y = fwd and whose +Z = ref made perpendicular to fwd. */
function basisQuat(fwd: THREE.Vector3, ref: THREE.Vector3, out: THREE.Quaternion) {
  _y.copy(fwd).normalize();
  _z.copy(ref).addScaledVector(_y, -ref.dot(_y)).normalize();   // caller guarantees ref is not parallel to fwd
  _x.crossVectors(_y, _z);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}
type Aim = { bone: THREE.Bone; axisL: THREE.Vector3; refL: THREE.Vector3; frameInv: THREE.Quaternion; len: number };

function makeAim(bone: THREE.Bone, child: THREE.Object3D, refWorldRest: THREE.Vector3): Aim {
  const axisL = child.position.clone().normalize();
  const restW = bone.getWorldQuaternion(new THREE.Quaternion());           // load time only
  const refL = refWorldRest.clone().applyQuaternion(restW.invert());
  refL.addScaledVector(axisL, -refL.dot(axisL)).normalize();
  const frameInv = basisQuat(axisL, refL, new THREE.Quaternion()).invert();
  return { bone, axisL, refL, frameInv, len: child.position.length() };
}
/** Requires bone.parent.matrixWorld to be current (solve top-down). */
function setWorldQuat(bone: THREE.Object3D, qW: THREE.Quaternion) {
  bone.parent!.matrixWorld.decompose(_p, _pq, _s);
  bone.quaternion.copy(_pq.invert().multiply(qW));
  bone.updateWorldMatrix(false, false);   // this bone only; children are solved next
}
function aim(a: Aim, dirW: THREE.Vector3, refW: THREE.Vector3) {
  setWorldQuat(a.bone, basisQuat(dirW, refW, _q).multiply(a.frameInv));
}
```
- Bone **positions** stay at their rest local translation, except Hips (pelvis height, sway). This keeps bone lengths exact and avoids skin stretch.
- `updateWorldMatrix(updateParents, updateChildren)` gives explicit control over ancestors and descendants [R16]. Solving top-down with `(false,false)` keeps every parent current before its child reads it. Avoid `getWorldPosition()` and `getWorldQuaternion()` in the hot path: they allocate if you pass `new`, and they walk the whole parent chain. Read `matrixWorld` directly (`_p.setFromMatrixPosition(bone.matrixWorld)`).
- Also prepare a *rest-delta* helper for bones you only bend partially: keep `restLocalQ` and set `bone.quaternion = restLocalQ · delta` from scratch each frame.

### 2.4 Analytic two-bone IK with pole (arm and leg)
Method (Holden's two-joint IK [R20], same idea as Unreal's TwoBoneIKSimple with pole and secondary axis [R21]):
1. Clamp the distance `L = |target − root|` to `[|l1−l2|+ε, l1+l2−ε]`. Clamp acos inputs to [−1, 1] [R20].
2. Shoulder angle: `cosA = (l1² + L² − l2²) / (2·l1·L)`.
3. Bend direction: `pp = pole − (pole·d)·d`, normalized, with `d = (target − root)/L`. If `pp` is degenerate, fall back to the rest pole. A near-straight limb makes the cross-product bend axis unstable, and an explicit pole cures it [R20].
4. `elbow = root + d·l1·cosA + pp·l1·sinA`.
5. `aim(upper, elbow − root, pp)`, then `aim(lower, wrist − elbow, pp)`. Compute `wrist = root + d·L` (the clamped target).
6. Set the end bone's world rotation directly (hand: from paddle grip, §6. Foot: from sole frame, §7).

Verified on this rig with three r180: wrist error 6e-8 m, elbow error 4e-8 m [L4]. `l1` and `l2` come from rest child offsets: upper arm 0.153 m, forearm 0.125–0.128 m, thigh about 0.25 m, shin 0.242 m [L1]. Multiply by the wrapper scale if you scale the character.

**Pole vectors (character space).**
- *Elbow:* backward + outward + down, for example `normalize(−0.6·fwd + 0.6·out − 0.5·up)` (*heuristic*). The rest elbow already points backward, at (0.13, 0.11, −0.99) in a +Z-facing wrapper [L4]. Hint/pole targets placed behind and outside the body keep the elbow from flipping [R43].
- *Knee:* along the foot's forward direction plus a little outward (about 10–15°, *heuristic*).

**Update order per frame** (each step reads only already-solved parents):
1. Wrapper (court position, facing yaw).
2. Hips: position and rotation (hip yaw/pitch/roll, §3).
3. Legs: thigh and shin aim, then Foot sole frame, then ToeBase (§7).
4. Spine → Spine1 → Spine2 distribution (§3).
5. Neck → Head look-at (§3).
6. Clavicles (Left/RightShoulder) elevation and protraction (§8).
7. For each arm: refresh `Arm.updateWorldMatrix(false,false)`, read the shoulder position, run two-bone IK, split forearm twist (§4), set Hand world rotation.
8. Fingers: local rotations only (§6).
9. Nothing else. `renderer.render` runs `scene.updateMatrixWorld()` and `skeleton.update()` once [L2].

### 2.5 Pitfalls
- **Scale.** This armature has no scale [L1]. Never give bones or the armature non-uniform scale: `matrix.decompose` and `Object3D.attach` are not valid under non-uniform scale [R16]. Uniform scale on the wrapper is fine if IK lengths are measured in world units.
- **Stale matrices.** Reading a bone position after its parent changed but before `updateWorldMatrix` gives last frame's value. That shows up as one-frame lag and jitter.
- **Quaternion hemisphere.** Before blending or slerping two solutions (e.g. pose-to-pose), flip one if `q1·q2 < 0`.
- **Don't mix `bone.rotation` (Euler) and `bone.quaternion` writes.** Use quaternions only.
- **Do not leave an `AnimationMixer` running on these bones.** It would overwrite the procedural values.

---

## 3. Spine, neck and head distribution

- People turn with neck and upper spine, not only the head. Distributing one total rotation across a chain looks natural and extends range. A typical three-joint split is 0.2 / 0.3 / 0.5 (lowest to highest), with a cap on the total angle [R22]. Golaem describes proportional distribution down a hierarchy [R24]. 3ds Max CAT spreads spine curvature evenly by default, with an editable bias curve [R25].
- **Overshoot trap.** Children inherit parent rotation. Giving every bone 100% of the target overshoots, so compute the total once and split it [R23].
- **Anatomy for twist (yaw).** Lumbar axial rotation is only a few degrees per side, against about 30° per side for the thoracic spine. Most trunk twist is thoracic [R26]. Mixamo's Spine sits about lumbar, and Spine1/Spine2 sit about thoracic.

**Starting weights** (*heuristic*, normalized; the sources above only justify the bias direction):

| Component | Spine | Spine1 | Spine2 |
|---|---|---|---|
| Yaw (twist toward the ball) | 0.15 | 0.35 | 0.50 |
| Pitch (forward lean in a dink) | 0.40 | 0.35 | 0.25 |
| Side bend (overhead/smash) | 0.30 | 0.35 | 0.35 |

**Neck/head.** Neck 0.4, Head 0.6 (*heuristic*, from [R22]'s 2-of-3 tail).

**Pelvis as root.** Hip yaw, pitch and roll go on Hips. The spine receives only the chest rotation *relative to the pelvis*.

**Absolute cumulative-slerp formula** (no drift). It works in character space with rest world rotations `R_i` (cached at load):
```
qP   = pelvisNow · inverse(pelvisRest)        // pelvis delta from rest
qRel = inverse(qP) · chestTargetDelta         // what the spine must add on top of the pelvis
for i in [Spine, Spine1, Spine2] with cumulative weights c = [w0, w0+w1, 1]:
    qChar_i = qP · slerp(I, qRelYaw, cYaw_i) · slerp(I, qRelPitch, cPitch_i) · R_i
    setWorldQuat(bone_i, wrapperWorldQ · qChar_i)
```
- With `c = 0` a bone follows the pelvis rigidly. With `c = 1` it reaches the chest target exactly.
- Decompose `qRel` into yaw about up and pitch about the chest-lateral axis (swing-twist, §4) so each component gets its own weights.
- Head: same formula from Spine2 with neck/head weights. Cap the total (about ±70° yaw for the head relative to the chest, *heuristic*) and smooth the target over time [R22].
- Spine twist pushes Spine2's children (clavicles, neck), so solve the arms **after** the spine (§2.4 order).

---

## 4. Forearm twist without twist bones

### 4.1 Why candy-wrapping happens and how much is tolerable
- Linear blend skinning averages bone matrices, and a blend of rigid motions is not rigid. Volume collapses where twist concentrates [R28]. Extra edge loops reduce the effect but do not remove it [R28].
- **Derived bound** (exact for a 50/50-weighted vertex ring, [L4]): with relative twist θ across a joint, the ring's radius scales by **cos(θ/2)**: 30° → 0.97, 45° → 0.92, 60° → 0.87, 90° → 0.71, 120° → 0.50.
  - Keep **≤ 45° of twist at any one weight seam** (under 8% shrink, *heuristic* threshold).
  - Never exceed 60°.
- Anatomy: forearm pronation and supination are each about 70–90° from neutral [R29]. That is up to about 170° total, which is far too much for one seam.

### 4.2 Distribute the twist (runtime)
Swing-twist decomposition splits a rotation into a twist about a chosen axis and the remaining swing [R27]. Rotations about one axis commute, so slerping from identity applies a fraction of the twist [R27]. A published avatar-control scheme splits wrist twist across elbow, forearm and wrist and puts all swing on the wrist [R27-patent, via search summary].

Without twist bones:
1. Aim the forearm with the *bend-plane* pole (zero-twist forearm `qF0`), as in §2.4.
2. `delta = inverse(qF0) · qHandWorld · inverse(handRestLocalQ)` gives the hand's change relative to the forearm, from rest.
3. `twist = twistAbout(delta, foreArm.axisL)`. Clamp its angle to ±85° [R29].
4. `forearm.quaternion.multiply(slerp(I, twist, f))` with **f ≈ 0.5** (*heuristic*: halves the wrist seam, moves the other half to the elbow seam). Then call `updateWorldMatrix(false,false)`.
5. `setWorldQuat(hand, qHandWorld)`. The hand automatically keeps the residual (1−f) twist plus all swing.

```ts
function twistAbout(q: THREE.Quaternion, axis: THREE.Vector3, out: THREE.Quaternion) {
  const d = q.x * axis.x + q.y * axis.y + q.z * axis.z;      // project the vector part onto the axis
  out.set(axis.x * d, axis.y * d, axis.z * d, q.w);
  if (out.lengthSq() < 1e-12) return out.identity();          // 180° swing singularity [R27]
  out.normalize(); if (out.w < 0) { out.x = -out.x; out.y = -out.y; out.z = -out.z; out.w = -out.w; }
  return out;                                                // swing = q · out⁻¹
}
```
Verified: it recovers a 120° twist exactly from a swing·twist product, and the half-slerp gives 60° [L4].

Also distribute *upper-arm* twist. Choosing the elbow pole explicitly (§2.4) means the upper arm's roll follows the bend plane, so shoulder-seam twist stays near zero unless the pole swings wildly.

### 4.3 Weight-painting fixes (Blender)
- **ForeArm↔Hand gradient.** Ramp from 100% ForeArm at about 45–50% of forearm length to about 50/50 at the wrist crease, then 100% Hand at the base of the palm (*heuristic*). A long ramp spreads the (1−f) twist over many vertex rings.
- **Arm↔ForeArm at the elbow.** Use a short, symmetric ramp of about ±1 edge loop around the crease, with the inner-elbow side biased slightly toward Arm to reduce collapse (*heuristic*).
- **Never weight forearm skin to finger bones**, and never weight the wrist to Arm.

### 4.4 Adding helper twist bones (optional, best quality)
- Twist joints spread wrist rotation down the forearm and fix candy-wrapping where volume loss is visible [R28].
- In Blender, the usual setup is a twist bone copying a fraction (about 0.5) of the hand's local Y rotation with local-to-local Copy Rotation. That is fragile when the hand also bends, and a damped-track helper is the documented workaround [R30].
- **glTF does not carry constraints.** The exporter bakes constraint results into sampled keys, and we export no animation [R31]. So a twist bone in our pipeline is just one more deform joint. Add `LeftForeArmTwist` as a child of `LeftForeArm`, at about 50% of its length with the same roll, and weight the distal half of the forearm to it. **The runtime drives it**: `twistBone.quaternion = restLocalQ · slerp(I, twist, 0.5)`, and the ForeArm itself gets 0.
- three handles extra joints transparently (they are only more bone-texture texels, §9). Update the canonical bone list and `validate.ts` if you add any.
- **Dual-quaternion skinning** removes candy-wrapping at small shader cost and uses the same weights [R32]. three has no built-in DQS [R14] and would need a custom shader patch. Not recommended at this scope.

---

## 5. Deformation and weights: shoulder, armpit, hip, knee, elbow (Blender 5.2 Python)

### 5.1 Game-rig rules
- At most 4 influences per vertex (glTF's base `JOINTS_0`/`WEIGHTS_0` set holds 4, and loaders are required to support at least 4) [R47][R36]. Most skin should have 1–2 influences, joints 2–3, and only shoulders and groin up to 4 (*heuristic*).
- Use smooth gradients across joints. Hard boundaries crease and pinch, and stray weights from distant bones are a classic bug. Test extreme poses and keep sums at 1 [R38].
- **Shoulder.** Balance clavicle (`*Shoulder`) against upper arm (`*Arm`) so arm elevation pulls the deltoid region along [R38].
- **Armpit "bat wings".** Remove arm weight from the torso side, then blur. Smoothing the spine groups also helps [R38].
- **Hip/groin.** Gradient from Hips to UpLeg across the front crease. Keep buttocks mostly on Hips, ramping to UpLeg (*heuristic*).
- **Knee/elbow.** Short ramps (about ±1 loop). Bias the back of the knee and the inner elbow toward the parent bone to limit collapse (*heuristic*).

### 5.2 Bone heat (Automatic Weights) failures and fixes
- "Failed to find solution" usually comes from mesh problems: duplicate or overlapping vertices, separate islands (teeth, hair), or asymmetric bone naming. The fixes are Merge by Distance, separating parts, weighting each part, then rejoining [R33].
- **Scale.** Bone heat is sensitive to world scale and density. Scaling mesh and rig up about 10×, applying, weighting, then scaling back is the established workaround [R33].
  - This rig is **1.0 m tall with ~2 cm fingers**, which is exactly the regime that fails. The previous attempt's "detached fingers" match this failure.
  - Apply rotation and scale on both objects (scale 1) before parenting [R33].
- **Visibility.** Islands with no vertices visible to any bone fail [R33].
- **This mesh** is one manifold island once 692 seam duplicates are welded (5,087 → 4,395 with `remove_doubles(threshold=1e-5)`) [L3]. Welding only coincident seam vertices is safe: UVs live per-loop and the glTF exporter re-splits the seams.
- **Exclude end bones** from heat by setting `bone.use_deform = False` for `*4`, `*_End` and `HeadTop_End` *before* binding.

### 5.3 Audit metrics to compute first (headless Python)
Per vertex:
- influence count and sum;
- dominant bone;
- "illegal pair" flags, i.e. weights > 0.02 on two bones from incompatible regions:
  - trunk + ForeArm/Hand;
  - trunk + Arm below armpit level on the arm side;
  - any finger + another finger's chain beyond phalanx 1;
  - Left + Right;
  - leg + Spine1/Spine2.
- Asymmetry: for each left vertex, the max absolute weight difference against its mirrored partner with L/R names flipped (KD-tree match, tolerance 0.01 m).

Report counts and save before/after numbers to `tools/rig/out/weights-report.json`. Baseline from [L1]: trunk+upperArm 235 verts (123 suspicious), clav+trunk 383, clav+upperArm 323, distalArm+upperArm 150.

### 5.4 Fix strategies (prefer the least destructive)
1. **Region masks + clean + smooth (targeted).**
   - For the arm zones, build vertex masks from geometry: distance to the bone segment, and a side-of-plane test against an "armpit plane" through the shoulder joint perpendicular to the lateral axis.
   - Zero the illegal groups inside each mask, then smooth **only those vertices**: Edit Mode, select the mask, then `vertex_group_smooth`.
2. **T-pose weighting + topology transfer** (fixes A-pose bleed).
   - Duplicate the rig and mesh.
   - Pose the duplicate's arms horizontal and apply the Armature modifier to the duplicate mesh.
   - Apply pose as rest with `bpy.ops.pose.armature_apply()`.
   - Scale ×10, run `parent_set(type='ARMATURE_AUTO')`, scale back.
   - Copy weights to the original by index with **Data Transfer `vert_mapping='TOPOLOGY'`** (vertex order is identical). Restrict the copy to the arm/shoulder/torso-side masks.
3. **Data Transfer from a cleaner proxy.** `data_transfer(data_type='VGROUP_WEIGHTS', vert_mapping='POLYINTERP_NEAREST', layers_select_src='ALL', layers_select_dst='NAME', mix_mode='REPLACE')`.

### 5.5 Normalize pipeline (operators verified to exist in 5.2.2 with these parameters [L3])
```python
import bpy
# group_select_mode accepts exactly: 'ACTIVE', 'BONE_DEFORM', 'ALL'   [L3]
bpy.ops.object.vertex_group_clean(group_select_mode='BONE_DEFORM', limit=0.01, keep_single=True)
bpy.ops.object.vertex_group_limit_total(group_select_mode='BONE_DEFORM', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='BONE_DEFORM', lock_active=False)
# Smooth polls only in Weight Paint or Edit mode (it FAILS in Object mode)   [L3]
bpy.ops.object.mode_set(mode='EDIT')        # select only the region vertices first!
bpy.ops.object.vertex_group_smooth(group_select_mode='BONE_DEFORM', factor=0.5, repeat=2, expand=0.0)
bpy.ops.object.mode_set(mode='OBJECT')
# Then re-run limit_total(4) and normalize_all, because smoothing re-spreads influences.
```
Other verified signatures [L3]:
- `parent_set(type='ARMATURE_AUTO', xmirror=False)`
- `mesh.remove_doubles(threshold=1e-4 default, use_centroid=True)`
- `vertex_group_quantize(steps)`
- `vertex_group_levels(offset, gain)`
- `vertex_group_mirror(mirror_weights, flip_group_names, all_groups, use_topology)`
- `armature.calculate_roll(type='POS_X'|'GLOBAL_POS_Z'|…)`
- `pose.armature_apply(selected=False)`

Note: the glTF importer sets object `rotation_mode='QUATERNION'`. Set it to `'XYZ'` before editing `rotation_euler`, or the rotation is silently ignored [L3].

### 5.6 Mirroring weights to fix L/R asymmetry. Built-in X-mirror does NOT work here
- Blender's weight X-mirror relies on symmetric names (`.L/.R`, `_L/_R`). Without a counterpart it paints the active group symmetrically. Topology mirror needs matching mirrored topology [R37], and mirror modes have had confusing bugs [R37].
- **On this asset** [L3]:
  - After import the lateral axis is Blender **Y**, not X, so `vertex_group_mirror` (which mirrors across local X) reported "0 vertices mirrored, 5087 failed".
  - After rotating rig and mesh 90° about Z (left arm now at +X, character facing −Y) and welding, position mirror still mirrored 0 of 4,395 and topology mirror mirrored 228. Cause: the mesh is only symmetric to within 0.2–6 mm.
  - Also, Mixamo names use `Left…`/`Right…` *prefixes*, not `.L`/`.R` suffixes.
- **Use a custom KD-tree mirror** (choose the better side per region, copy to the other):
```python
import bpy, mathutils
from mathutils import kdtree
def flip(n): return n.replace('Left','§').replace('Right','Left').replace('§','Right')
def mirror_weights(obj, src_sign=+1, tol=0.01, lateral=0):  # lateral axis index in object space (1 = Y as imported, 0 = X after rotating)
    me = obj.data; co = [v.co.copy() for v in me.vertices]
    kd = kdtree.KDTree(len(co)); [kd.insert(c, i) for i, c in enumerate(co)]; kd.balance()
    names = {g.index: g.name for g in obj.vertex_groups}
    for v in me.vertices:
        if v.co[lateral] * src_sign >= -1e-6: continue          # only write the destination side (midline stays)
        m = v.co.copy(); m[lateral] = -m[lateral]
        _, j, dist = kd.find(m)
        if dist > tol: continue                                 # report misses
        src = {flip(names[g.group]): g.weight for g in me.vertices[j].groups}
        for g in list(v.groups): obj.vertex_groups[g.group].remove([v.index])
        for n, w in src.items(): obj.vertex_groups[n].add([v.index], w, 'REPLACE')
```
  Run it in Object mode, then normalize (§5.5). For better quality on uneven tessellation, interpolate on the nearest mirrored face (`mathutils.bvhtree`) instead of using the nearest vertex. Midline vertices (abs(lateral) < 1 mm) keep their own weights.

### 5.7 Real-time correctives available in three (cheap)
1. Better weights (above).
2. Runtime twist split or twist bones (§4).
3. Joint limits and clearance in the solver (§8). Avoid extreme poses instead of correcting them.
4. Optional morph targets driven by joint angle via `morphTargetInfluences`. They are cheap in three but were retired by the board, so revisit only for the elbow or shoulder if still needed.
5. DQS needs a custom shader (§4.4).

### 5.8 Export from Blender: deform bones only, 4 influences (verified option names [L3])
```python
import re
LEAF = re.compile(r'(_End$|Hand(Thumb|Index|Middle|Ring|Pinky)4$)')   # the 13 unweighted leaf bones
for b in arm.data.bones:      # optional prune of leaf markers (see §9)
    if LEAF.search(b.name):
        b.use_deform = False
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_skins=True, export_def_bones=True,          # deform bones only (+ parents needed for hierarchy) [R34]
    export_influence_nb=4, export_all_influences=False, # top-4 by weight, normalized [R35]
    export_rest_position_armature=True,                 # rest pose as joints' rest
    export_leaf_bone=False, export_animations=False, export_morph=False,
    export_yup=True, export_apply=False)
```
- `export_def_bones` keeps deform bones plus the parents they need [R34]. It used to require animation sampling, and that coupling was lifted in 2022 [R34].
- Without "all influences" the exporter sorts groups by weight, keeps the top 4, and normalizes [R35]. Still do Limit Total 4 + Normalize yourself before export so the report reflects what ships [R36].
- After export, re-run the §0 measurements on the new GLB. Check: joint count, every child translation still `(0,L,0)`, weight sums equal 1, max 4 influences, no weights on pruned bones, facing as decided in §1.6.
- If Stage B quantizes weights (meshopt/gltf-transform), re-check sums afterwards.

---

## 6. Fingers and grip

### 6.1 Curl axes from rest geometry (per side, at load)
- Palm frame, using rest world positions of Hand (H), Index1 (I) and Pinky1 (P):
  - knuckle line `k = P − I`;
  - long axis `a = ((I+P)/2 − H)`, normalized;
  - palm normal `n_L = normalize((P−H) × (I−H))` for the **left** hand and `n_R = normalize((I−H) × (P−H))` for the right.
  - Sanity check on this rig: the left palm normal is about (−0.11, −0.63, −0.77) in glTF space, i.e. down and toward the midline, as expected in A-pose [L1].
- Per-phalanx hinge axis: `h = k` projected perpendicular to that phalanx's rest direction, normalized. Pick the sign so a small +θ moves that phalanx's tip toward `n`: test once at load and flip if needed.
- Convert `h` into each bone's local frame once: `hL = inverse(restWorldQ_bone) · h`.
- Runtime: `bone.quaternion = restLocalQ · axisAngle(hL, θ)`. The hinge stays fixed relative to the bone, so parents carry it correctly. Fingers are local-only, so update them after the hand.
- Do not assume local X or Z: on this rig the curl axis sits about 50° between them [L1].

### 6.2 Angles for wrapping a cylinder (paddle handle)
- Geometry: a phalanx of length l lying as a chord on a circle of radius R (handle radius + half finger thickness) needs a joint bend of about **θ = 2·asin(l / 2R)** at its proximal joint (*derived*).
  - Use it for PIP (middle phalanx) and DIP (distal phalanx).
  - Set MCP so the proximal phalanx meets the handle, typically 40–70°.
- Clamp to anatomical ROM, roughly: MCP 80–90°, PIP 90–105°, DIP 65–85° maximum flexion [R39]. A real-world handle example: middle phalanx 25 mm and R = 25 mm give PIP ≈ 60°; distal 20 mm gives DIP ≈ 47° (*derived*).
- Measure l on the rig: Index1→2 ≈ 22 mm, Index2→3 ≈ 20 mm (the model is 1.0 m tall) [L1]. Pick R so fingers just touch the scaled paddle handle.
- Grip style (*heuristic*):
  - Fingers progressively tighter from index to pinky, +5–10° per finger.
  - Index slightly spread toward the paddle face (trigger finger, about −10° MCP).
  - Small per-finger spread about the palm normal: index −5°, ring +4°, pinky +8°.
- **Thumb opposition.**
  - Aim Thumb1 so Thumb2 lands on the handle opposite the index's middle phalanx, using the `aim` pattern with ref = palm normal.
  - Then curl Thumb2 and Thumb3 (about 20–40° each, *heuristic*) about hinges computed as above. Use the thumb's own knuckle reference: the cross of the thumb direction with `n`.
- **Rigid palm.** Weight only Hand to the palm (§5.1). Keep finger1 influence off the palm beyond the knuckle crease. Never rotate Hand to fake curl.

### 6.3 Attaching the paddle
- Parent the prop to the hand bone so it follows the skeleton, then set a local offset. A dedicated socket bone or `Object3D` makes alignment easier [R40]. Check bone scale if the prop vanishes or shrinks [R40]. This rig's bone scale is 1 [L1].
- Recipe:
  - `socket = new Object3D(); rightHand.add(socket)`.
  - Socket position is the palm center + n·(R + palm half-thickness).
  - Socket rotation is `basis(handleAxis, n)`, where handleAxis is the knuckle line tilted about 20–30° toward the wrist (diagonal handshake grip, *heuristic*).
  - `socket.add(paddle)`.
- **Drive IK from the paddle.** Given the desired paddle world pose `Pw` and the constant socket-to-hand transform `S`, the hand world target is `Pw · S⁻¹`. Use its position as the wrist target (§2.4) and its rotation as `qHandWorld` (§4.2). Precompute `S⁻¹` once and use `Matrix4.multiplyMatrices` with temporaries.

---

## 7. Feet: locking, ankle alignment, toe bend

- Standard foot placement:
  - Smooth the ground contact.
  - Lower the pelvis by the largest foot drop (only ever down).
  - Run leg IK.
  - Rotate the foot so its up axis matches the ground normal, computed in world space and converted to local.
  - Blend IK per foot with a plant weight from contact events or a velocity threshold, so IK doesn't fight the swing [R41].
- Locking: on plant, store the contact point and yaw in world space and solve IK to it until lift-off [R42]. Release the lock and blend back to the swing curve.
- **Foot roll / heel lift.** A step rolls heel → flat → ball → toes → lift-off, and the pivot moves between those points [R42]. Reverse-foot rigs chain heel → toe → ball pivots [R42].
- **Sole frame (load time).**
  - forward = (ToeBase − Foot) flattened onto the ground plane;
  - up = +Y;
  - `soleOffset = inverse(basis(up, forward)) · footRestWorldQ`.
  - This rig's rest foot bone points forward-down about 31°, while the ToeBase points horizontally forward [L1]. Use the sole frame, never the bone axis, to decide "flat".
- **Runtime.**
  - `qFoot = basis(groundNormal, footYawFwd) · pitch(−heelLift about lateral) · soleOffset`.
  - When heel-lifted by φ about the ball (ToeBase joint, world `B`), the ankle target is `B + R(φ)·(ankleRest − ballRest)` in the sole frame.
  - Counter-rotate ToeBase by −φ about its hinge (§6.1 method, hinge = lateral axis) so the toes stay flat. Clamp φ ≤ about 50° (*heuristic*).
  - Trigger heel lift when the hip-to-locked-ankle distance exceeds about 0.97·(l1+l2), and in push-off/lunge phases, instead of letting the knee lock straight.
- Knee pole: foot-forward plus slightly outward (§2.4). Recompute every frame from the locked foot yaw so the knee tracks the foot.

---

## 8. Arm–torso clearance in procedural animation

1. **Pole first.** A pole behind and outside the body stops the elbow flipping inward [R43] (values in §2.4).
2. **Clamp the elbow (and hand) out of a torso volume in world space.**
   - Local-space clamping breaks when the character rotates, and world space is robust [R43].
   - Torso: a capsule from Hips to Spine2 (or a box for the torso and pelvis [R43]) with radius = torso half-width + arm radius + margin (on this 1.0 m model about 0.09–0.11 m, *heuristic*; measure from the mesh).
   - After solving, compute the segment–capsule distance for shoulder→elbow and elbow→wrist. If either penetrates:
     - push the elbow radially out to the surface;
     - set the pole to `(pushedElbow − shoulder)`;
     - re-solve once.
   - If the *target* (hand) is inside, as in a cross-body backhand, push the target out along the capsule normal first.
3. **Joint limits.** Hinge the elbow (one plane) and limit shoulder abduction and adduction. Ball-socket the wrist [R43].
4. **Clavicle participation.** Raise and protract `*Shoulder` as the arm elevates. Scapulohumeral rhythm is about 2:1 glenohumeral to scapular on average, with little scapular motion in the first ~30° [R44].
   - *Heuristic:* clavicle gets 0% below 30° of elevation, ramping to about 25–33% of the extra elevation above that.
   - Protract the clavicle forward when the hand crosses the body midline.
5. **Weights first.** If skin still sticks after the skeleton clears, it is the §0/§5.3 trunk↔arm contamination, not the solver.
6. **QA metric.** Each frame, minimum distance from elbow and wrist to the torso capsule axis should be ≥ radius. Log violations in debug builds.

---

## 9. Performance: 4 skinned characters in WebGL

- **GPU path.**
  - r180 always skins on the GPU from a float **bone texture**, using `texelFetch` with 4 texels per matrix [L2]. WebGL1 is unsupported since r163 [R45], so no uniform-array bone limit applies.
  - Texture side = ceil(sqrt(4·bones)/4)·4: **65 bones → 20×20, 52 bones → 16×16 RGBA32F** [L2]. That is a few KB per character, re-uploaded once per frame.
  - Pruning end bones is tidy but performance-irrelevant. Keep them if the runtime wants fingertip and head-top positions.
- **CPU per frame per character** [L2]:
  - about 67 node world-matrix updates;
  - 65 matrix multiplies in `skeleton.update()`;
  - our solver's ~45 `setWorldQuat` calls (one `decompose` each).
  - Well under 0.1 ms for four characters (*estimate*).
  - Shadow-casting lights re-run vertex skinning in the depth pass.
- **Instancing.** `SkeletonUtils.clone(gltf.scene)` per player shares geometry and materials and gives each clone its own skeleton [R19]. Dispose with `skeleton.dispose()`: disposing the mesh alone leaks the bone texture [R45].
- **Allocation-free math.**
  - Module-level `Vector3`/`Quaternion`/`Matrix4` temporaries.
  - Rest data precomputed into typed objects.
  - No `clone()`, no `new` in `update()`.
  - Avoid `getWorld*()` (parent-chain walks).
  - Avoid `traverse` and name lookups per frame: cache bone references at load.
- Leave `matrixAutoUpdate` on (we write `quaternion`). Don't call `scene.updateMatrixWorld(true)` yourself. The renderer does it [L2].

---

## 10. Prioritized checklists

### (a) Blender weight-audit agent (`sol`)
1. Import `human-rig.glb` headless. Assert: 65 bones, 65 vertex groups, 5,087 verts, armature and mesh scale 1, mesh parented to the armature [L3].
2. Decide facing with `opus` (§1.6). If converting: set `rotation_mode='XYZ'`, rotate +90° about Z, apply rotation on both objects. The character then faces −Y and exports as glTF +Z [L3].
3. Set `use_deform=False` on the 13 end bones (§1.4, §5.2).
4. Weld seams: `remove_doubles(threshold=1e-5)`. Expect 4,395 verts and one island [L3].
5. Run the audit metrics (§5.3) and write the baseline to `weights-report.json`.
6. Fix arm↔trunk contamination first (§5.4 strategy 1 or 2). Re-measure. Target: zero trunk weight below the armpit plane on arm vertices, and zero arm weight on torso-side vertices beyond the blend band.
7. Forearm/Hand gradient and elbow ramp (§4.3). If candy-wrapping is still visible at ±60° twist, add `*ForeArmTwist` bones (§4.4) and tell `opus`.
8. Fingers: every finger vertex dominated by its own chain. No palm vertex beyond the knuckle crease on finger bones. No weights on end bones. If re-weighting, do it at 10× scale [R33].
9. Mirror the better side (§5.6 KD-tree script, tolerance 1 cm). Report misses.
10. Clean 0.01 → Limit Total 4 → Normalize All → (region smooth) → Limit 4 → Normalize (§5.5).
11. Pose test renders: arm abducted 90°, arm forward and across the body, elbow 120°, wrist twist ±60°, deep lunge, squat, fist. Compare before and after.
12. Export with §5.8 options. Re-verify §0 facts on the output. Keep bone names unchanged (`mixamorig:` prefix).

### (b) Runtime-retarget agent (`opus`)
1. Load the GLB. Wrap it in `Object3D` (rotation per §1.6, uniform scale only). Clone 4 players with `SkeletonUtils.clone` [R19].
2. Map bones with `canonicalBoneName` (`userData.name` first, prefix regex) and assert all 52 names exist (§1.5).
3. Keep `AttachedBindMode` and the loader's bind. Never call `calculateInverses`. Optionally call `normalizeSkinWeights()`. Set `frustumCulled=false` or enlarge the bounds (§2.1).
4. At load, in rest: cache `restLocalQ`, rest world/character quaternions, `axisL`, `refL`, `frameInv`, segment lengths, the rest elbow and knee poles, palm frames, sole frames, finger hinges (§2.3, §6.1, §7).
5. Implement `basisQuat` / `setWorldQuat` / `aim` / `twoBone` / `twistAbout` with module temporaries (§2.3–§4.2). Unit-test them against this rig: wrist error < 1e-6 m, no drift over 1,000 frames, right side mirrors left [L4].
6. Follow the per-frame order in §2.4: wrapper → Hips → legs/feet → spine distribution → neck/head → clavicles → arms (IK + 50% forearm twist) → hand from the paddle socket inverse → fingers.
7. Spine/neck weights per §3, using the absolute cumulative-slerp formula.
8. Clearance: elbow pole, torso capsule push-out with one re-solve, clavicle rhythm, joint limits (§8). Add a debug overlay for the capsule and the poles.
9. Feet: lock and plant weights, sole-frame alignment, heel lift about the ball with ToeBase counter-bend (§7).
10. Grip: per-phalanx curl from the chord formula clamped to ROM, thumb opposition, paddle on a hand socket (§6).
11. Zero per-frame allocations: profile one frame with the allocation tracker. No `getWorld*`, `clone` or `new` in hot paths (§9).
12. QA hooks for `flash`: per frame, min elbow/wrist-to-torso distance, max per-seam twist angle (≤ 45°), max finger ROM usage, foot-slide distance while planted.

---

## Local verification (this session)
- **[L1]** Parsed `tools/rig/source/human-rig.glb` JSON and binary with Node:
  - node TRS, world frames per joint, child offsets, lengths, A-pose angles;
  - weight histogram, unused bones, region-pair contamination counts;
  - palm normal and finger-curl axis versus local axes.
- **[L2]** Read three r180 sources in `node_modules/three`:
  - `src/objects/Skeleton.js` (`calculateInverses`, `update`, `computeBoneTexture` sizing);
  - `src/objects/SkinnedMesh.js` (`bind`, `updateMatrixWorld` bindMode, `normalizeSkinWeights`);
  - `examples/jsm/loaders/GLTFLoader.js` (`createUniqueName`→`sanitizeNodeName`, `userData.name`, `mesh.bind(skeleton, identity)`);
  - `src/renderers/webgl/WebGLObjects.js` (one `skeleton.update()` per frame);
  - `ShaderChunk/skinning_pars_vertex.glsl.js` (bone texture via `texelFetch`);
  - `src/math/Frustum.js` (lazy bounding sphere).
- **[L3]** Ran Blender 5.2.2 LTS headless (`--factory-startup`, read-only on the source file):
  - introspected `export_scene.gltf`, `object.vertex_group_*`, `object.data_transfer`, `object.parent_set`, `mesh.remove_doubles`, `armature.calculate_roll`, `pose.armature_apply` RNA parameters and defaults;
  - imported the GLB (importer default `bone_heuristic='BLENDER'`, armature `rotation_mode='QUATERNION'`);
  - measured symmetry and welding;
  - confirmed that `vertex_group_smooth` polls only in Weight Paint or Edit mode and that `group_select_mode` ∈ {ACTIVE, BONE_DEFORM, ALL};
  - confirmed `vertex_group_mirror` failing (0 mirrored; 228 with topology) before and after rotating to Blender front.
- **[L4]** Node test with three r180: rebuilt the skeleton from the GLB, ran the §2.3/§2.4 recipe and the §4.2 twist decomposition, checked errors and drift. Name sanitization: `mixamorigHips` with `userData.name = mixamorig:Hips`.

## Sources
- R1 three.js `PropertyBinding.js` (sanitizeNodeName, reserved chars): https://github.com/mrdoob/three.js/blob/dev/src/animation/PropertyBinding.js
- R2 three.js PropertyBinding docs: https://threejs.org/docs/pages/PropertyBinding.html
- R3 Discourse, dots/colons removed by GLTFLoader: https://discourse.threejs.org/t/avoid-dots-and-colons-being-deleted-from-models-name/15304 , and duplicate naming: https://discourse.threejs.org/t/naming-of-duplicate-nodes-and-meshes/42025
- R4 Discourse, "No target node found … mixamorigRightUpLeg": https://discourse.threejs.org/t/error-three-propertybinding-no-target-node-found-for-track-when-applying-mixamo-animation-to-sketchfab-model/70898
- R5 Mixanimo add-on notes (mixamorig1:Hips variant): https://mixanimo.gumroad.com/l/mixanimo_pro ; GameDev.tv prefix thread: https://community.gamedev.tv/t/re-mixamo-bone-names-in-3pc-t/201395
- R6 Adobe Community, DAE uses `mixamorig_`: https://community.adobe.com/t5/mixamo-discussions/blender-addon-not-generating-ik-rig-on-characters-exported-as-dae/m-p/12196761/highlight/true
- R7 Mixamo→VRM map used with three (52 sanitized names): https://huggingface.co/spaces/AIbee999/CharacterGen_test/blob/604b72580a799f334d82bcc49c9075dce80694f4/render_script/three-js/src/mixamoVRMRigMap.js
- R8 Blender bone Y axis / roll: https://blenderartists.org/t/how-to-change-bones-local-axis-orientation/549368
- R9 Blender glTF importer bone-direction heuristic: https://lists.blender.org/pipermail/bf-extensions-cvs/2020-March/009452.html
- R10 three.js retargeting with differing roll: https://discourse.threejs.org/t/retargeting-issues/45895
- R11 Mixamo root at hips (NVIDIA forum): https://forums.developer.nvidia.com/t/random-result-when-importing-fbx-animation/238212
- R12 glTF coordinate convention (+Z front), quoted on X3D list: https://web3d.org/pipermail/x3d-public_web3d.org/2024-November/020891.html ; Godot docs: https://docs.godotengine.org/en/4.2/tutorials/assets_pipeline/importing_3d_scenes/model_export_considerations.html
- R13 A-pose vs T-pose: https://cgcookie.com/community/20686-t-pose-or-not-to-t-pose-or-a-pose ; https://polycount.com/discussion/comment/2544903/ ; https://blog.neural4d.com/?p=3575
- R14 three.js SkinnedMesh docs: https://threejs.org/docs/pages/SkinnedMesh.html
- R15 three.js Skeleton docs: https://threejs.org/docs/pages/Skeleton.html
- R16 three.js Object3D docs (updateWorldMatrix, attach and non-uniform scale): https://threejs.org/docs/pages/Object3D.html
- R17 three.js CCDIKSolver docs: https://threejs.org/docs/pages/CCDIKSolver.html
- R18 three-ik: https://www.npmjs.com/package/three-ik ; README: https://github.com/whatisor/THREE.IK/blob/master/README.md
- R19 three.js SkeletonUtils docs: https://threejs.org/docs/pages/module-SkeletonUtils.html
- R20 D. Holden, Simple Two Joint IK: https://theorangeduck.com/page/simple-two-joint
- R21 Unreal TwoBoneIKSimple: https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/ControlRig/FRigUnit_TwoBoneIKSimple
- R22 Vulkan tutorial, Look-At controllers: https://docs.vulkan.org/tutorial/latest/Advanced_glTF/Procedural_Animation_IK/05_look_at.html
- R23 Unreal Community, head/eye look-at (overshoot): https://unrealcommunity.wiki/head-and-eye-look-at-tutorial-fq2ru1sq
- R24 Golaem look-at distribution: https://golaem.com/node/14291
- R25 3ds Max CAT spine curvature: https://help.autodesk.com/cloudhelp/2015/ENU/3DSMax/files/GUID-73AB138B-3357-4C04-BB5E-8135D3698921.htm
- R26 Spine rotation ranges: https://learnmuscles.com/?p=17182 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC11612942/
- R27 Swing-twist decomposition: https://arxiv.org/pdf/1506.05481 ; fractional twist (sterp): https://gamedev.net/forums/topic/696882-swing-twist-interpolation-sterp-an-alternative-to-slerp ; twist split across elbow/forearm/wrist (patent): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12322017
- R28 Candy-wrapper / LBS: https://www.cs.utexas.edu/~fussell/courses/cs384g/lectures/lecture15.pdf ; https://polycount.com/discussion/comment/2562285 ; https://alecjacobson.com/weblog/2104.html
- R29 Forearm ROM: https://wikem.org/wiki/Joint_ROM_(Table) ; https://eatonhand.com/clf/clf218.htm
- R30 Blender twist-bone setups: https://blenderartists.org/t/forearm-twist-bug/695187 ; https://polycount.com/discussion/comment/2390190
- R31 glTF exporter bakes constraints: https://lists.blender.org/pipermail/bf-extensions-cvs/2019-April/007858.html ; https://forum.babylonjs.com/t/exporting-a-skinned-mesh-those-skeleton-is-rigged-by-another-skeleton/19167
- R32 Kavan et al., Dual Quaternion Skinning: https://users.cs.utah.edu/~ladislav/dq/
- R33 Bone-heat failures and fixes: https://blenderartists.org/t/bone-heat-weighting-failed-to-find-solution-for-one-or-more-bones/701412 ; https://lists.blender.org/pipermail/bf-animsys/2017-April/000260.html ; https://projects.blender.org/blender/blender/issues/84609 ; https://projects.blender.org/blender/blender/issues/103409 ; https://projects.blender.org/blender/blender/issues/45493 ; https://cgcookie.com/community/6826-the-mystery-of-rigify ; https://community.gamedev.tv/t/bone-heat-weighting-failed-to-find-solution-for-one-or-more-bones/230350
- R34 glTF exporter "deform bones only": https://developer.blender.org/rBAb9b1814a4c26f73aae7f306c9ff2e21b7b7bdcee ; https://developer.blender.org/rBA807a64cdfc50de1cfb263f2eb68680feddb66ec7 ; https://blenderartists.org/t/any-way-to-select-which-bones-to-eport-in-gltf-export/1652793
- R35 glTF exporter top-4 + normalization: https://lists.blender.org/pipermail/bf-extensions-cvs/2019-February/007638.html ; https://lists.blender.org/pipermail/bf-extensions-cvs/2022-April/010894.html
- R36 Vulkan tutorial, Blender workflow (Limit Total 4): https://docs.vulkan.org/tutorial/latest/Advanced_glTF/Tooling_Production_Pipeline/02_blender_workflow.html
- R37 Blender weight-paint mirror options: https://docs.blender.org/manual/en/2.79/sculpt_paint/painting/weight_paint/options.html ; bug T72158: https://developer.blender.org/T72158
- R38 Weight-painting practice: https://polycount.com/discussion/comment/1862600 ; https://wiki.redmodding.org/cyberpunk-2077-modding/for-mod-creators-theory/3d-modelling/meshes-and-armatures-rigging/weight-painting-for-gonks ; https://3d.irpr.agency/glossary/weight-painting/
- R39 Finger ROM: https://thieme-connect.de/products/ejournals/abstract/10.1055/s-0044-1788593 ; AAOS table: https://cdn-links.lww.com/permalink/prsgo/b/prsgo_8_6_2020_04_17_hendriks_gox-d-20-00155r2_sdc1.pdf
- R40 Attaching props to bones in three: https://discourse.threejs.org/t/how-to-put-a-weapon-in-a-characters-hand/22121 ; https://discourse.threejs.org/t/attaching-a-3d-model-mesh-to-a-bone/6182
- R41 Vulkan tutorial, foot placement: https://docs.vulkan.org/tutorial/latest/Advanced_glTF/Procedural_Animation_IK/04_foot_placement.html
- R42 Foot roll / planted keys: https://www.autodesk.com/learn/ondemand/curated/realtime-rigging-reverse-foot-systems/7qu98pHE31w7dhNe8TmNSX ; https://help.autodesk.com/cloudhelp/2015/ENU/3DSMax/files/GUID-32D8C6C0-C6D5-4666-B339-0BDE9C713BE4.htm ; https://courses.cs.washington.edu/courses/cse459/09wi/projects/rigging_assignment/leg.html
- R43 Clearance building blocks: https://docs.vulkan.org/tutorial/latest/Advanced_glTF/Physics_Integration/02_bone_proxy_colliders.html ; https://create.roblox.com/docs/building-and-visuals/animation/inverse-kinematics ; https://bugnet.io/blog/how-to-fix-unity-two-bone-ik-constraint-hand-not-reaching-weapon-grip ; https://gamedev.net/forums/topic/590357/
- R44 Scapulohumeral rhythm: https://www.physio-pedia.com/Scapulo_Humeral_Rhythm ; https://pmc.ncbi.nlm.nih.gov/articles/PMC2841046
- R45 GPU skinning and bone textures: https://discourse.threejs.org/t/is-gpu-skinning-depreciated/86826 ; https://threejs.org/docs/pages/WebGLRenderer.html ; https://discourse.threejs.org/t/skinnedmesh-texture-leak/19907
- R46 Tripo rigging API (`spec: mixamo`): https://developers.tripo3d.com/en/docs/animations-rig.md
- R47 glTF skins: https://github.khronos.org/glTF-Tutorials/gltfTutorial/gltfTutorial_020_Skins.html ; https://github.com/andreasplesch/x3dom/wiki/HAnim-and-glTF-skins
- R48 three lookAt aims +Z for non-cameras: https://discourse.threejs.org/t/object3d-orientation-axis-in-threejs/30240 ; https://discourse.threejs.org/t/lookat-behaviour-difference-between-camera-and-object3d/44431
