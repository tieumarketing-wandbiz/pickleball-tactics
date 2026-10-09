# Shot-by-shot fix loop (2026-10-09) — Codex-Sol reviews, Pi-Sol implements, coordinator commits

User's instruction: fix the motions **one at a time**, both CLIs on GPT-6.1-Sol **xhigh**. Fix **one character only**
(A1, right-handed, team A) — the code is shared, so it applies to all 4 players. Visual review uses A1 only; the
automated body gate (`tests/body-gate.test.ts`) still covers team B + left-handed by mirroring, cheaply.

## Roles
| Agent | Runs as | Does | Owns |
|---|---|---|---|
| **sol** | Codex · gpt-6.1-sol · xhigh · `--search` (web) · sandbox network on · MCP `blender` | 1) finish skin weights (Blender); 2) per shot: **research + review** → `review.md`, then **verdict** after the fix | `tools/rig/**` (Blender), `tools/review/**`, `.agents/shots/*/review.md`, `.agents/shots/*/verdict.md` |
| **pisol** | Pi · openai/gpt-6.1-sol · xhigh | per shot: **implement** the review in code, keep the body gate green, render after-images → `fix.md` | `src/**`, `tests/**`, `vite.config.ts`, `.agents/shots/*/fix.md` |
| coordinator | Claude | sequencing, checks, **git commits** (Codex's sandbox keeps `.git` read-only — agents never commit) | `.agents/README.md`, `tasks/*`, git |

Both may *read* everything (incl. `git diff`, `git log`). Never edit the other agent's files — write a request in your
status file instead. Dev server http://localhost:5173 is the only server; never start/kill it.

## Shot queue (in order)
| # | Folder | Scope |
|---|---|---|
| 1 | `01-ready-footwork` | ready stance (kitchen + baseline), split step, shuffle / side-step, recovery-to-ready — **legs first** |
| 2 | `02-serve` | underhand pendulum serve, ball toss/drop, weight shift, rear-foot step |
| 3 | `03-dink` | dink (fore/back), deep squat, kitchen step-in/out |
| 4 | `04-volley-punch-block` | volley, punch, block (compact, arms clear of torso) |
| 5 | `05-drive` | forehand + two-handed backhand drive from the baseline |
| 6 | `06-drop-reset` | third-shot drop, reset |
| 7 | `07-lob` | lob |
| 8 | `08-smash` | overhead (cocked prep, off arm up, down-across finish) |
| 9 | `09-speedup-roll-flick` | speedup, roll, flick |
| 10 | `10-atp-erne` | ATP, Erne (footwork-heavy) |

## Per-shot protocol
1. **sol → `review.md`**: web research for this shot (cite URLs; coaching sources, slow-motion analyses), plus our
   references (`video-guide.md`, `technique-research.md` §A/§E, `animation-principles.md`). Render A1 for the shot at
   ready / anticipation / load / breakdown / contact / follow / settle from front, side and top
   (`src/debug/pose-lab.html` via Playwright `PW_CHANNEL=chrome`, or your own `tools/review/render-shot.mjs`), save in
   the shot folder as `before-<phase>-<view>.png`. Write a **numbered defect list**: what is wrong, where (phase, body
   part), target numbers (angles, heights, distances, timings), priority. End with an acceptance checklist.
2. **pisol → `fix.md`**: implement item by item; after every change run the body gate + `npm test`; never accept a red
   gate. Render `after-<phase>-<view>.png` with the same tool and camera. Answer each defect number: fixed / partly / not,
   with evidence.
3. **sol → `verdict.md`**: compare before/after images against the defect list and references. `PASS`, or a short list of
   remaining items → back to step 2 (max 2 extra rounds; then record the leftovers and move on).
4. **coordinator**: checks, commits `shot NN: <name>`, starts the next shot. Sol may review shot N+1 while pisol works on N.

## Status files
`.agents/status/sol.md`, `.agents/status/pisol.md` — current shot, step, blockers, requests. Keep them short.
