# Motion sources for the pickleball players: Mixamo, NVIDIA Kimodo, alternatives

Researched 2026-10-08. Target: three.js r180, Mixamo-standard skeleton (`mixamorig:*`, 65 joints incl. fingers, A-pose), skinned GLB of about 5k verts, 4 players, procedural key poses plus analytic two-bone IK.
Tags: **[src]** means a cited page says it. **[exp]** means general practitioner knowledge that was not re-verified this session; check it in the UI or docs before relying on it. **[est]** means a calculated estimate, not a measurement.

---

## TL;DR

- **Mixamo** works well for **locomotion, idles and celebrations** on this exact skeleton, because the bone names match. I found **no evidence that Mixamo has tennis, racket or pickleball stroke clips**. Searches for them only turned up third-party paid packs (Fab, TurboSquid, Sketchfab) [src: search results below]. Keep strokes procedural.
- **Kimodo** is real and public. Code is Apache-2.0 and the SOMA/G1 weights use the NVIDIA Open Model License, which allows commercial use. It is a text- and constraint-conditioned kinematic motion diffusion model that outputs a SOMA 77-joint skeleton (NPZ or BVH) at 30 fps, max 10 s. It can run on the RTX 5080 only with the text encoder on CPU, and it needs gated Meta Llama-3-8B-Instruct access on Hugging Face. It is offline only, so it cannot run inside the web app. Use it at most as an offline source of extra locomotion or reaction clips. Its "right hand at frame k" constraint is useful, but runtime IK still has to hit the real contact point.
- **Plan:** use a clip-driven lower body and idle layer, with procedural strokes, IK, foot-lock and kitchen-line rules layered on top after `mixer.update()`. The added bundle should be about **50–150 KB** after gltfpack/meshopt [est].

---

## A. Mixamo

### A1. What it offers
- A free web service from Adobe. It needs an Adobe ID but no Creative Cloud subscription. It provides an auto-rigger for bipedal humanoids and a large motion library ("Motion" = single clips, "MotionPack" = bundles such as locomotion packs) [src: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (403 to bots; content quoted via https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775), https://app.cinevva.com/guides/free-character-animations-rigging].
- A 2026 third-party guide describes the service as working but unmaintained. Treat it as stable but frozen [src: cinevva guide above].
- The animation library opens from the Animations tab or the Find Animation button, and it is searched by keyword or category [src: https://helpx.adobe.com/creative-cloud/help/animate-characters-mixamo.html].
- **We cannot browse the catalogue without logging in.** The site and its `api/v1/products` endpoint return 403 to unauthenticated requests. The clip names below come from forum and tutorial evidence plus practitioner knowledge. **The user should search each term and pick the closest title.**

### A2. Clip names relevant to this app (search terms, then likely titles)
| Need | Mixamo search term | Likely titles (verify) | Evidence |
|---|---|---|---|
| Side shuffle (fast) | `strafe` | Left Strafe, Right Strafe | [exp]; strafe clips exported via Mixamo are mentioned at https://mocaponline.itch.io/mobility-pro-animations |
| Side step (slow) | `strafe walk` | Left Strafe Walking, Right Strafe Walking | Adobe thread naming "Left Strafe Walking.dae": https://community.adobe.com/t5/mixamo-discussions/animation-is-in-place-immovable-problem-in-place-to-check-the-options/m-p/12305529 |
| Backpedal | `jog backward`, `run backward` | Jog Backward, Jog Backward Diagonal, Running Backward | "jog backward diagonal" named in the Adobe thread above |
| Forward run/jog | `jog`, `run` | Jog Forward, Jog Forward Diagonal, Running, Fast Run | [exp] |
| Walk back (between points) | `walking backward` | Walking Backwards | [exp] |
| Ready stance / bounce | `idle` | Offensive Idle, Fighting Idle, Goalkeeper Idle | [exp] |
| Rest breathing | `breathing idle` | Breathing Idle | a Mixamo breathing idle is mentioned at https://forum.reallusion.com/PrintTopic503103.aspx |
| Jump / split-step source | `jump`, `hop` | Jump, Standing Jump | [exp] |
| Lunge / reach / dive | `goalkeeper`, `catch`, `lunge` | Goalkeeper Catch, Goalkeeper Diving Save, Goalkeeper Scoop | goalkeeper clips are mentioned at https://forum.babylonjs.com/t/is-it-possible-to-make-goalkeeper-animation-like-fifa-game-with-babylon-js/23282 |
| Overhead (reference only) | `baseball`, `throw` | Baseball Hit, Baseball Pitching | "baseball hit" preset: https://community.adobe.com/t5/mixamo-discussions/adding-objects-to-existing-mixamo-animations-after-mixamo-download/td-p/12573919 |
| Celebrate | `victory`, `cheer`, `fist pump`, `clap` | Victory, Victory Idle, Cheering, Fist Pump, Clapping, Excited | [exp] |
| Lose a point | `disappointed`, `defeated` | Disappointed, Defeated, Shaking Head No | [exp] |
| Pick up ball | `pick up` | Picking Up | [exp] |
| Tennis or racket strokes | `tennis`, `racket`, `swing` | **Probably none.** No source found. | Search results listed only paid packs: Fab "Tennis Shots" (https://www.fab.com/listings/78060d27-657b-413d-b442-73f8d18cab75), Fab "Male Tennis Player Animated" (https://www.fab.com/listings/4eb88974-9a4c-4de7-8064-41f4eb91f275), Sketchfab forehand/backhand (https://sketchfab.com/3d-models/tennis-forehand-shot-4e43074509e046debf5201c1df6eb40e) |

Another free sports source on the Mixamo skeleton: Rokoko's "12 free sports animations" pack. It is FBX at 30 fps on the Mixamo skeleton with fingers, and the page allows commercial use. The download needs a sign-up form, and clip titles are not listed publicly [src: https://rokoko.com/resources/rokoko-mocap-12-free-sports-animations].

### A3. Download options
- **Format:** FBX Binary (.fbx) is the usual choice for Blender/glTF. FBX for Unity is effectively the same file. Collada (.dae) is also offered [src: https://github.com/ux3d/mixamo2gltf2, https://kybernetik.com.au/animancer/docs/manual/getting/mixamo].
- **Skin:** With Skin includes the mesh. **Without Skin** is the armature plus animation only and is much smaller; choose it for every clip [src: same].
- **Frames per Second:** 30 is the baseline. 60 is slightly smoother but larger [src: same]. The dropdown offers 24/30/60 [exp].
- **Keyframe Reduction:** none, uniform or non-uniform. mixamo2gltf2 recommends *uniform* to avoid artifacts [src: https://github.com/ux3d/mixamo2gltf2]. Here, pick **none** and let gltfpack or gltf-transform reduce keys later, so the reduction is deterministic.
- **In Place** (checkbox on locomotion clips in the editor panel) removes forward root travel so the clip loops on the spot. Its behaviour depends on the clip and on Mirror (see the Adobe "in place" thread above). Other per-clip sliders are Overdrive (speed), Character Arm-Space (arm spread), Trim and Mirror [exp].
- **Uploading the user's own character:** Mixamo accepts FBX, OBJ or ZIP uploads [exp]. If the user exports their GLB to FBX from Blender and uploads it, every clip is baked onto *their* bone lengths and rest pose. That is the cleanest way to avoid retargeting. Uploading is something the user does, not us.

### A4. License (not legal advice)
- Adobe's FAQ says characters and animations are **royalty-free for personal, commercial and non-profit projects, including video games**. Credit is optional [src: Adobe FAQ via the community copy above].
- **Not allowed:** distributing the **raw character or animation files** as a product, such as engine asset packs or templates that redistribute them. Using the files within your own project team is fine [src: same; also https://community.adobe.com/questions-696/use-and-distribution-of-created-animations-based-on-mixamo-animations-589442]. The FAQ also excludes training ML models [src: search summary of the same FAQ].
- **What this means for a web app:** shipping clips *embedded in the app* (optimized GLB loaded by the game) is the normal games case. Do **not** commit the raw Mixamo FBX files to a public repo or offer them for download. Keep `/assets-src/mixamo/*.fbx` git-ignored and ship only the processed, merged animation GLB. A determined user can extract a GLB from any web game, but the line Adobe draws is redistribution "as the product".
- An Adobe account is required to download. **The user must do the downloads themselves.**

### A5. FBX to Blender 5.2 to GLB
1. **Import:** File > Import > FBX. In Blender 5.x each FBX take becomes its own Action, with each animated object in its own Action Slot (layered or slotted actions) [src: https://docs.blender.org/manual/en/5.2/files/import_export/fbx.html]. Options worth setting [exp]: *Automatic Bone Orientation* **off**, which keeps Mixamo bone axes identical to the user's rig. *Ignore Leaf Bones* **on**, which drops the `*_End` bones; the manual's armature option "ignore the last bone at the end of each chain" is the same thing.
2. **Units gotcha [exp]:** Mixamo FBX is in centimetres. The imported armature often has scale 0.01 on the object, or hip translation keys in cm. Either apply scale (Ctrl+A > Scale) before transferring actions, or later scale the `Hips.position` track by 0.01 in JS. If you skip this, the hips fly off by 100×.
3. **Put all clips on the user's rig:** import each FBX, rename its Action (e.g. `loco_strafeL`), then delete the imported armature. Assign the actions to the user's armature. Names match (`mixamorig:Hips` etc.), so fcurves bind directly. Push each to an NLA track, or export with Action mode "Actions" [exp].
4. **Export glTF 2.0 (.glb) [exp]:** Include > Selected Objects (armature only, or armature plus mesh for the base file). Data > Mesh off for an animation-only file. Animation > Mode: Actions. Sampling Rate 1 (every frame). *Always Sample Animations* on. *Optimize Animation Size* on. *Export Deformation Bones Only* on. Check that each Action becomes one `gltf.animations[i]` with its name.
5. **Naming in three.js [exp]:** GLTFLoader passes node names through `PropertyBinding.sanitizeNodeName`, which strips reserved characters including `:`. So `mixamorig:Hips` becomes `mixamorigHips` in *both* model and clips, and they still match. Code that looks bones up by name must use the sanitized form.

### A6. Retargeting onto this Mixamo-named skeleton
- **Same names and the same rest orientation per bone** (the clip was downloaded on the user's uploaded character, or the user's rig was built with Mixamo's bone axes): tracks apply **directly**. Mixamo quaternion tracks are full local rotations, so the A-pose versus T-pose difference does not matter as long as each bone's local axes and roll match.
- **Same names but different rest orientations or rolls** (the user's rig was hand-built in Blender, and the clip was downloaded on Y Bot, which is T-pose):
  - Per bone, in world space: `G_tgt(t) = G_src(t) · R_src⁻¹ · R_tgt`, where `R` is each skeleton's global rest rotation, evaluated in a **common reference posture**.
  - Because the user's rig is A-pose and Y Bot is T-pose, first make a T-pose reference of the user's rig. Rotate the upper arms down by about 45° and use that posture as `R_tgt` instead of the bind pose. Then convert back to local space: `L = G_parent⁻¹ · G`.
  - Hips translation: scale by the leg-length ratio.
- **Tools:**
  - three.js `SkeletonUtils.retargetClip` (addons). It is known to be finicky, see https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149.
  - Rokoko Blender add-on (free, but needs a free Rokoko account; Blender 5 support unconfirmed) [src: https://www.blendernation.com/2021/12/23/retargeting-using-rokoko-complete-guide/].
  - Auto-Rig Pro (paid).
  - A small Blender Python baking script using the formula above.
- **Recommendation:** upload the user's own FBX to Mixamo once and download every clip on it. That gives zero retargeting work.

### A7. Size per clip and compression
- **Raw [est]:** a Blender export samples T, R and S for every bone at 30 fps. 65 bones × 30 fps × (12 + 16 + 12 B) is about **78 KB per second** of float data, plus time arrays. A 1 s loop is about 80 KB and a 3 s celebration is about 240 KB.
- **After optimization [est]:**
  - Drop constant tracks (scale everywhere, translation on all but Hips).
  - Drop or freeze the ~40 finger bones, since the procedural grip owns the hands.
  - Quantize rotations to 12–16 bit.
  - Apply meshopt and gzip.
  - The result is about **3–8 KB per second**, so a 1 s loop is 3–8 KB and the whole recommended set (~25 s of motion) is about **50–150 KB**.
- **Tools:**
  - **gltfpack** (meshoptimizer) quantizes and resamples animation. `-af N` sets the resample rate (default 30 Hz). `-ar N` sets rotation bits (default 12, range 4–16). `-at` and `-as` set translation and scale bits (default 16). `-ac` keeps constant tracks (leave it off). `-c` / `-cc` add meshopt compression. `-kn` keeps named nodes [src: https://manpages.debian.org/testing/gltfpack/gltfpack.1, https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md].
  - **gltf-transform:** `resample` losslessly deduplicates keyframes. `meshopt` compresses "geometry and animation". `prune` / `dedup` clean up [src: https://gltf-transform.dev/cli, https://gltf-transform.dev/modules/functions/functions/meshopt].
  - Example pipeline [exp]: `gltf-transform resample in.glb a.glb && gltf-transform prune a.glb b.glb && gltfpack -i b.glb -o anims.glb -ar 14 -at 14 -cc -kn` (no mesh in this file).
- **three.js decoding:** EXT_meshopt_compression is supported since r122, but you must call `loader.setMeshoptDecoder(MeshoptDecoder)` from `three/addons/libs/meshopt_decoder.module.js` [src: meshoptimizer README above].

### A8. Blending clips with procedural IK in three.js
- **Mixer basics [exp]:**
  - One `AnimationMixer` per player, rooted at the player's `SkinnedMesh` or scene.
  - Create actions with `mixer.clipAction(clip)`.
  - Locomotion is a blend space: weight Idle / StrafeL / StrafeR / JogFwd / JogBack via `action.setEffectiveWeight(w)`, all playing in sync with `action.syncWith()`.
  - Speed matching: `action.timeScale = groundSpeed / clipNativeSpeed`.
- **Masking:** three.js has no bone masks. Make masked copies by filtering tracks:
  ```js
  const LOWER = new Set(['mixamorigHips','mixamorigLeftUpLeg','mixamorigLeftLeg','mixamorigLeftFoot','mixamorigLeftToeBase','mixamorigRightUpLeg','mixamorigRightLeg','mixamorigRightFoot','mixamorigRightToeBase']);
  const mask = (clip, set, name) => new THREE.AnimationClip(name, clip.duration,
    clip.tracks.filter(t => set.has(t.name.split('.')[0])).map(t => t.clone()));
  ```
  Keep the Hips *rotation* in the lower set and blend Spine/Spine1/Spine2 separately (counter-rotation for the coil).
- **Additive layers:** `THREE.AnimationUtils.makeClipAdditive(clip, refFrame=0, refClip=clip, fps=30)` and then `action.blendMode = THREE.AdditiveAnimationBlendMode`. Use this for breathing, ready-bounce or flinch on top of whatever the base is. See the official example at https://threejs.org/examples/#webgl_animation_skinning_additive_blending. `AnimationUtils.subclip(clip, name, startFrame, endFrame, fps)` cuts loops [exp].
- **Order per frame [exp]:**
  1. `mixer.update(dt)` writes bone `.quaternion` and `.position`.
  2. Procedural upper-body stroke pose: slerp each arm and spine bone from the mixer result toward the key-pose quaternion with `wStroke(t)`, ramping 0 to 1 to 0 around the shot window.
  3. Two-bone arm IK to the exact contact point at the exact time.
  4. Foot-lock / leg IK (planted feet, kitchen-line clamp).
  5. `skeleton.bones[0].updateMatrixWorld(true)`.

  The mixer overwrites only bones that have tracks in an active action. Bones you write procedurally but that have no track **will not be reset**, so set them absolutely every frame rather than incrementally.
- **Root motion:** use **In Place** clips, or strip the X/Z of the `Hips.position` track in code and keep Y for bob. The tactics planner owns the world position and heading. Drive clip phase from distance travelled (`timeScale` as above) so foot-lock contacts line up with the clip's foot plants. Optionally read the Mixamo clip's original root speed once, offline, to get `clipNativeSpeed`.
- **Mirroring:** for left-handed players, mirror at the data level (swap Left/Right track names and negate the appropriate quaternion components). Alternatively, download a second copy with Mixamo's Mirror toggle.

---

## B. NVIDIA Kimodo

### B1. What it is
- **"Kimodo: Controllable Kinematic Motion Diffusion at Scale"** from NVIDIA's Spatial Intelligence Lab. Project lead is Davis Rempe; the model team includes Mathis Petrovich, Xue Bin Peng and others. It was released 16 Mar 2026, with v1.1 on 10 Apr 2026. Tech report: arXiv 2603.15546.
- It is a kinematic motion diffusion model trained on large-scale optical mocap, controlled through text and constraints. It generates **human (SOMA, SMPL-X) and humanoid-robot (Unitree G1)** motion.
- It uses a two-stage denoiser (root, then body) to reduce artifacts.
- Sources: https://research.nvidia.com/labs/sil/projects/kimodo/, https://arxiv.org/pdf/2603.15546, https://rits.shanghai.nyu.edu/ai/nvidia-releases-kimodo-controllable-text-to-motion-for-characters-and-humanoid-robots/
- **Training data:** "RP" models use Bones Rigplay (~700 h, proprietary). "SEED" models use BONES-SEED (288 h, 142k motions, 120 fps source, BVH on SOMA-77). The BONES-SEED dataset itself sits behind a gated licence on HF (https://huggingface.co/datasets/bones-studio/seed). That licence covers the data, not the model; commercial dataset licences are sold separately [src: https://www.roboticstomorrow.com/news/2026/03/17/bones-studio-to-release-bones-seed-the-first-multimodal-motion-dataset-purpose-built-for-humanoid-robotics/26276/].

### B2. Inputs and outputs
- **Inputs** [src: https://research.nvidia.com/labs/sil/projects/kimodo/docs/user_guide/constraints.html]:
  - Text prompt, or a sequence of prompts with per-prompt durations and transition frames.
  - Duration (frames).
  - A constraints JSON. Types are `root2d` (2D path/waypoints plus optional heading), `fullbody` (keyframes), `left-hand` / `right-hand` / `left-foot` / `right-foot`, and generic `end-effector` with `joint_names`.
  - Each constraint carries `frame_indices` (0-based) and targets joint **positions** (derived by forward kinematics from the given local rotations) and global rotations.
  - Coordinates are Y-up, metres; frame 0 root is at the XZ origin.
- **Model card limits** [src: https://huggingface.co/nvidia/Kimodo-SOMA-SEED-v1.1]: **30 fps, max 10 s (300 frames)**. Output is root translation [T,3] plus joint rotations [T,30,3,3].
- **Model card caveats:** foot skating, imperfect prompt following, and no scene or object awareness. It is "best at locomotion, gestures, combat, dancing, and everyday activities".
- **Outputs** [src: https://research.nvidia.com/labs/sil/projects/kimodo/docs/user_guide/output_formats.html, .../cli.html]:
  - Kimodo NPZ with `posed_joints`, `local_rot_mats`, `global_rot_mats`, `foot_contacts` [T,4], `root_positions` and more. J is 77 for SOMA, 34 for G1 and 22 for SMPL-X.
  - **BVH** for SOMA models via `--bvh`. It uses the somaskel77 hierarchy and is in cm. `--bvh_standard_tpose` gives a T-pose rest.
  - AMASS-style NPZ for the SMPL-X model.
  - MuJoCo qpos CSV for G1.
  - No FBX or glTF.

### B3. Skeletons and variants
- **SOMA** (NVIDIA's parametric body model; 30 joints internally, exported as 77): RP-v1.1, SEED-v1.1, RP-v1, SEED-v1.
- **G1**: RP-v1, SEED-v1.
- **SMPL-X**: RP-v1 only, under the **NVIDIA R&D (research-only) licence**.
- **It is not SMPL and not Mixamo.** [src: https://github.com/nv-tlabs/kimodo]

### B4. Availability and licence
- **Code:** https://github.com/nv-tlabs/kimodo, Apache-2.0.
- **Weights:** HF collection https://huggingface.co/collections/nvidia/kimodo-v1. SOMA and G1 weights use the **NVIDIA Open Model License**, and the model card says the model is "ready for commercial use". NVIDIA does not claim ownership of outputs, and the user is responsible for outputs [src: https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-agreement/]. The **SMPL-X model is research-only.**
- **Text encoder:** LLM2Vec on **`meta-llama/Meta-Llama-3-8B-Instruct`**, which is **gated**. You need an HF account with granted access plus a read token, and Meta's Llama 3 Community License applies to the encoder [src: https://research.nvidia.com/labs/sil/projects/kimodo/docs/getting_started/installation.html].
- **Demo:** a local web UI (`kimodo_demo`, Viser, 127.0.0.1:7860) with a timeline, constraint tracks and export. A hosted HF Space exists at https://huggingface.co/spaces/nvidia/Kimodo (shown "Running on L40S"; I could not confirm its features or whether login is needed).
- **For this web app:** generated clips embedded in the app are fine under the Open Model License as described. The model cannot run in the browser.

### B5. Hardware and software on this machine
- **Requirements** [src: GitHub README, installation docs, model card]:
  - Python 3.10 (conda example) and PyTorch 2.0 or newer with CUDA.
  - Developed and tested on Linux. The README says Windows "should work especially if using Docker", while the model card lists Linux and Windows.
  - Tested on RTX 3090/4090/5090, A100, L40S and others. Blackwell is listed as supported.
- **VRAM:** about **17 GB** to run fully on GPU, mostly for the text encoder. With `TEXT_ENCODER_DEVICE=cpu` it needs **under 3 GB**. A community fork with an NF4-quantized encoder needs about 5 GB [src: https://github.com/matbeedotcom/kimodo].
- **RTX 5080 (16 GB):** use `TEXT_ENCODER_DEVICE=cpu`, or Docker/WSL2 with the CPU encoder. The RTX 50 series needs a PyTorch build with Blackwell (sm_120) support, meaning CUDA 12.8 or newer wheels [exp].
- **Downloads:** about 16 GB for the encoder plus the model weights, done by the user [src: https://huggingface.co/ZeyuLing/Motius-KIMODO-G1-RP notes that the encoder tree is about 16 GB].
- Nothing was installed or downloaded during this research.

### B6. Can it make pickleball swings?
- **Partly.** The `right-hand` end-effector constraint at `frame_indices: [k]` with a 3D position is exactly "hand at the contact point at time t". Root2d can pin the stance, and foot constraints can pin the planted foot. A post-process step runs foot-skate cleanup and constraint optimization.
- **Limitations:**
  - Training coverage of racket sports is unknown. The model card says it is strongest at locomotion, gestures, combat and dance.
  - There is no paddle or object awareness.
  - Wrist and paddle-face orientation would come only from the hand rotation constraint.
  - 30 fps quantizes contact timing to 33 ms.
  - Every new contact point needs a new offline generation, which takes seconds on a GPU.
- **Conclusion:** Kimodo cannot replace the runtime contact-exact IK. At best it is an **offline style reference**: a handful of canonical stroke shapes (forehand drive, backhand dink, overhead) whose pelvis and spine timing you mine to improve the procedural key poses. It can also supply extra locomotion or reaction clips if Mixamo lacks one, such as split step, lunge recovery or crossover step.

### B7. Workflow: Kimodo to the Mixamo skeleton
1. Generate with `kimodo_gen "a person shuffles sideways to the left in an athletic stance" --model Kimodo-SOMA-RP-v1.1 --duration 2.0 --num_samples 4 --bvh --bvh_standard_tpose --constraints c.json --output shuffleL`. Use RP for quality; RP is the default and recommended.
2. Import the BVH into Blender 5.2 (File > Import > BVH; scale 0.01 because BVH is in cm).
3. Retarget SOMA-77 to `mixamorig:*`:
   - Build a bone map by reading the BVH hierarchy; the SOMA joint names are not documented on the pages read.
   - Both are now in T-pose, so the world-delta formula in A6 applies, with the user's rig posed into T-pose as the reference.
   - Tools: Rokoko add-on with a custom mapping (needs a free Rokoko login), Auto-Rig Pro Remap (paid), or a short bake script (copy-rotation constraints in world space, then NLA bake).
4. Clean up: lock feet using Kimodo's `foot_contacts`, make it In Place by zeroing the Hips XZ, and loop-match the first and last frame.
5. Export as a glTF Action into the same `anims.glb` and run the A7 pipeline.

---

## C. Alternative motion sources (short)

| Source | What | Licence / cost notes |
|---|---|---|
| **CMU Graphics Lab Mocap** (mocap.cs.cmu.edu; BVH and FBX conversions exist) | ~2,600 free mocap takes, including some sports; ASF/AMC originals | Free for research and commercial use. Citation and acknowledgement requested. Do not resell the data itself, even converted [src: https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df]. Needs retargeting to Mixamo. |
| **Rokoko Video** (video to mocap from the user's own pickleball footage) | Browser tool; exports FBX/BVH with a Mixamo skeleton preset; body only, no hands | Free Starter tier is capped at about 30 s of processing per month; paid Basic gets 600 s per month. Commercial terms not confirmed [src: https://rokoko.com/products/video, https://rokoko.com/pricing/]. |
| **DeepMotion Animate 3D** / **Move.ai** | Video to mocap; DeepMotion exports FBX/BVH/GLB | DeepMotion's free tier is reportedly limited and the commercial licence appears to need a paid plan (unofficial: https://toolradar.com/tools/deepmotion/pricing). Move.ai is paid. Check official terms. |
| **ActorCore (Reallusion)** / Fab / TurboSquid tennis packs | Professional mocap; real tennis forehand/backhand/serve sets exist on Fab and TurboSquid | Paid, royalty-free for embedded use (check each licence). Closest thing to real racket strokes [src: Fab links in A2, https://marketplace.reallusion.com/sport-motion-pack]. |
| **Text-to-motion models:** HY-Motion 1.0 (Tencent, Dec 2025, SMPL-H output), MDM, MotionGPT | Offline generation | HY-Motion uses a custom Tencent community licence; it reportedly allows commercial use under 100M MAU and **excludes the EU, UK and South Korea** [src: https://arxiv.org/abs/2512.23464v1, https://github.com/Tencent-Hunyuan/HY-Motion-1.0/issues/49]. MDM and MotionGPT are trained on HumanML3D/AMASS, which are generally research-only, so avoid them for shipping. All need SMPL to Mixamo retargeting. |

---

## D. Recommendation for this app

### D1. What stays procedural (do not replace)
- **All 15 strokes** (serve … erne): key poses plus analytic two-bone IK so the paddle meets the exact contact point at the exact time. No library has paddle-accurate clips, and contact points change every rally.
- **Foot locking and plant feet** during swings, **kitchen-line / NVZ constraints** (no foot over the line on volleys, erne foot placement), and **ATP / erne** paths.
- **Grip and hands:** keep the procedural finger pose; strip the finger tracks from clips.
- **Split step:** a procedural 120–180 ms hop timed to the opponent's contact. It can borrow its curve from a Mixamo jump, but its timing must be game-driven.

### D2. What comes from clips
- **Locomotion (lower body plus pelvis bob):** idle-ready, shuffle L/R, slow side-step L/R, jog forward, backpedal, diagonals.
- **Idles (additive):** breathing on spine and neck; a ready bounce on knees and hips at low weight.
- **Between-point and reactions (full body, no IK):** celebrate, fist pump, clap, disappointed, pick up ball, walk back.

### D3. Layering per player (three.js)
1. **Base:** a lower-body masked locomotion blend space driven by the planner's local velocity. Lateral speed picks strafe or shuffle, forward speed picks jog or backpedal, and near zero gives the ready idle. `timeScale` is matched to speed. Clips are In Place, and the planner owns root XZ and heading.
2. **Upper base:** the ready-idle upper body (or the full-body idle when stationary).
3. **Additive:** breathing at weight 0.3–0.6, faded out during the stroke window.
4. **Stroke:** the existing procedural key-pose sampler writes spine and arm quats, slerped over the mixer result with `wStroke(t)`. In the last ~150 ms before contact, the **lower body** also ramps from clip to procedural so the stance and foot-lock are exact.
5. **IK and constraints:** two-bone arm IK to the contact point, then leg IK and foot-lock, then the kitchen-line clamp.
6. **Celebrations:** a full-body action crossfaded in with `crossFadeTo` (0.25 s) after the point ends. Strokes and IK are disabled.

Cost: one mixer per player (4 total), about 10 actions each, only 2–5 with non-zero weight at a time. That is negligible on any GPU or CPU.

### D4. Expected bundle cost [est]
- One shared `anims.glb` with no mesh holds ~22 clips and ~25 s of motion.
- Fingers stripped, constant tracks pruned, 14-bit rotations, gltfpack `-cc`.
- Total about **50–150 KB** (gzip/brotli on top helps a bit more), plus the meshopt decoder at about 20 KB [exp].
- An unoptimized Blender export of the same clips would be about 1.5–2.5 MB.

### D5. Exact Mixamo download list (the user does this while logged in)
**Step 0 (recommended):** export the user's character from Blender as FBX (armature plus mesh, Mixamo bone names) and **upload it to Mixamo**, so all clips are baked on the user's own rig. If Mixamo rejects it, use **Y Bot** and apply A6.

**Settings for every clip:**
- Format **FBX Binary (.fbx)**
- Skin **Without Skin**
- Frames per Second **30**
- Keyframe Reduction **none**
- **In Place ✔** wherever the checkbox exists (all locomotion)
- Overdrive 0 and Arm-Space default unless noted

Save as `assets-src/mixamo/<id>.fbx`, git-ignored, never redistributed.

| id | Search & pick | Notes |
|---|---|---|
| `idle_ready` | "Offensive Idle" (or "Goalkeeper Idle") | Low athletic stance. Loop. |
| `idle_breath` | "Breathing Idle" | Used as an additive source. |
| `shuffle_L` / `shuffle_R` | "Left Strafe" / "Right Strafe" | Fast lateral. In Place. Pick the jog-speed version. |
| `sidestep_L` / `sidestep_R` | "Left Strafe Walking" / "Right Strafe Walking" | Slow lateral adjust. In Place. |
| `jog_fwd` | "Jog Forward" | In Place. |
| `run_fwd` | "Running" (or "Fast Run") | In Place. For deep lobs and transitions. |
| `backpedal` | "Jog Backward" (or "Running Backward") | In Place. Retreat for lobs. |
| `jog_fwd_diag_L/R` | "Jog Forward Diagonal" (Mirror for the other side) | In Place. Optional. |
| `jog_back_diag_L/R` | "Jog Backward Diagonal" (Mirror) | In Place. Optional. |
| `walk_back` | "Walking Backwards" | Between points. |
| `walk_fwd` | "Walking" | Between points and to the baseline. |
| `hop` | "Jump" (short, standing) | Curve source for the split step only. |
| `lunge_reach` | "Goalkeeper Catch" or a "lunge" result | Reference for wide reaches and recovery. Optional. |
| `cele_fist` | "Fist Pump" | Point won. |
| `cele_cheer` | "Cheering" or "Victory" | Game or match won. |
| `cele_clap` | "Clapping" | Partner's winner. |
| `react_bad` | "Disappointed" (or "Defeated") | Point lost. |
| `pickup` | "Picking Up" | Optional flavour. |

After the downloads, run the Blender batch: import each, rename the Action to its `id`, move it onto the user's armature, export one animation-only GLB, then run the A7 pipeline and `setMeshoptDecoder`.

### D6. Kimodo: optional, later
Only if a needed locomotion or reaction clip is missing from Mixamo, or to mine pelvis/trunk timing for the procedural strokes. It needs the gated Llama-3 access and a Linux, WSL2 or Docker setup with the CPU text encoder. Do it after the Mixamo layer is in and measured.
