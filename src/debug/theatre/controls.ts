// Theatre.js props for the demo: ~10 high-level controls per motion sheet, not 52 raw bones.
// Units: metres and degrees. Body frame: x = right, y = up, z = forward (toward the net),
// origin on the ground between the feet. Labels are short because the studio panel truncates them:
//   pelvis offset from rest hips; chest yaw/pitch/roll relative to the pelvis; head = world look;
//   paddle: aim = face yaw (+right), open = face pitch (+sky), head = handle angle in the face
//   plane (0 = head to the right, 90 = up); elbow out = pole swivel; foot x/z = ankle on the ground. Defaults = the kitchen ready pose, so any prop that a
// sheet does not key sits at "ready".
import { types, type ISheet, type ISheetObject } from "@theatre/core";
import type { PoseControls } from "./rig";

const m = (v: number, range: [number, number], label?: string) =>
  types.number(v, { range, nudgeMultiplier: 0.005, label });
const deg = (v: number, range: [number, number], label?: string) =>
  types.number(v, { range, nudgeMultiplier: 1, label });

const foot = (side: 1 | -1) => ({
  x: m(0.3 * side, [-1.5, 1.5], "x right"),
  z: m(side > 0 ? -0.02 : 0, [-1, 1], "z fwd"),
  yaw: deg(12, [-45, 90], "toe-out°"),
  heel: deg(0, [0, 60], "heel lift°"),
  lift: m(0, [0, 0.4], "lift m"),
});

/** Object key → prop config. Keys with " / " show as folders in the studio outline. */
export const OBJECTS = {
  "Body / Pelvis": {
    pos: types.compound(
      {
        x: m(0, [-1.5, 1.5], "x right"),
        y: m(-0.1, [-0.5, 0.25], "y up"),
        z: m(-0.02, [-0.5, 0.5], "z fwd"),
      },
      { label: "offset m" },
    ),
    yaw: deg(0, [-90, 90], "yaw +R"),
    pitch: deg(10, [-20, 60], "pitch +fwd"),
  },
  "Body / Chest": {
    yaw: deg(0, [-90, 90], "yaw +R"),
    pitch: deg(12, [-30, 70], "pitch +fwd"),
    roll: deg(0, [-40, 40], "roll +R"),
  },
  "Body / Head": {
    yaw: deg(0, [-90, 90], "yaw +R"),
    pitch: deg(8, [-60, 70], "pitch +down"),
  },
  "Arms / Paddle hand R": {
    grip: types.compound(
      {
        x: m(0.1, [-1, 1.5], "x right"),
        y: m(1.02, [0, 2.4], "y up"),
        z: m(0.3, [-0.6, 1.2], "z fwd"),
      },
      { label: "grip m" },
    ),
    paddle: types.compound(
      {
        yaw: deg(-150, [-180, 180], "aim°"),
        pitch: deg(-20, [-90, 90], "open°"),
        roll: deg(50, [-180, 180], "head°"),
      },
      { label: "paddle" },
    ),
    elbow: deg(55, [-60, 90], "elbow out°"),
  },
  "Arms / Hand L": {
    wrist: types.compound(
      {
        x: m(-0.12, [-1.5, 1], "x right"),
        y: m(1.0, [0, 2.4], "y up"),
        z: m(0.3, [-0.6, 1.2], "z fwd"),
      },
      { label: "wrist m" },
    ),
    elbow: deg(35, [-60, 90], "elbow out°"),
  },
  "Legs / Foot L": foot(-1),
  "Legs / Foot R": foot(1),
};
export type ObjectKey = keyof typeof OBJECTS;
export const OBJECT_KEYS = Object.keys(OBJECTS) as ObjectKey[];

export const MOTIONS = [
  { id: "dink", label: "Dink" },
  { id: "punch-volley", label: "Punch volley" },
  { id: "split-step-shuffle", label: "Split step + shuffle" },
] as const;
export type MotionId = (typeof MOTIONS)[number]["id"];

export type MotionObjects = {
  [K in ObjectKey]: ISheetObject<(typeof OBJECTS)[K]>;
};
export function createObjects(sheet: ISheet): MotionObjects {
  const out = {} as Record<string, unknown>;
  for (const k of OBJECT_KEYS) out[k] = sheet.object(k, OBJECTS[k]);
  return out as MotionObjects;
}

/** Current values of a sheet's objects → rig controls. */
export function readControls(o: MotionObjects): PoseControls {
  const pelvis = o["Body / Pelvis"].value,
    chest = o["Body / Chest"].value,
    head = o["Body / Head"].value,
    handR = o["Arms / Paddle hand R"].value,
    handL = o["Arms / Hand L"].value;
  return {
    pelvis: { pos: { ...pelvis.pos }, yaw: pelvis.yaw, pitch: pelvis.pitch },
    chest: { ...chest },
    head: { ...head },
    handR: { grip: { ...handR.grip }, paddle: { ...handR.paddle }, elbow: handR.elbow },
    handL: { wrist: { ...handL.wrist }, elbow: handL.elbow },
    footL: { ...o["Legs / Foot L"].value },
    footR: { ...o["Legs / Foot R"].value },
  };
}
