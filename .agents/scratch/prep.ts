import { SHOT_TYPES } from "../../src/core/constants";
import { strokePreparation, STROKE_MOTION } from "../../src/core/stroke-motion";
import { readFileSync } from "node:fs";
const base = readFileSync("D:/AI/Code/Tieu/.backup-pickleball-2026-10-08/src/core/stroke-motion.ts", "utf8");
for (const t of SHOT_TYPES) {
  const m: any = (STROKE_MOTION as any)[t];
  const old = base.match(new RegExp(`\n  ${t}: \{[^}]*?prepare: ([0-9.]+)[^}]*?followTime: ([0-9.]+)[^}]*?recover: ([0-9.]+)`, "s"));
  console.log(t.padEnd(8), "prep now", strokePreparation(t as any).toFixed(2), "| profile prepare", m.prepare, "follow", m.followTime, "recover", m.recover, "| original prep/follow/recover", old ? old.slice(1).join("/") : "?");
}
