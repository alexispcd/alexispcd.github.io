// Tests du mapping steps -> description Intervals.icu. Fonctions pures, aucune
// I/O. Execution : deno test intervals_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  buildWorkoutDescription, formatDistanceToken, formatDurationToken,
  formatPace, groupByRepeat, paceTarget, sizeToken,
} from "./intervals.ts"
import type { PlanStep } from "./types.ts"

// Fabrique un step aplati avec des valeurs par defaut nulles.
const step = (p: Partial<PlanStep>): PlanStep => ({
  order_index: 0,
  step_type: "run",
  repeat_group: null,
  repeat_index: null,
  target_pace_sec: null,
  pace_tolerance_sec: null,
  distance_m: null,
  duration_sec: null,
  ...p,
})

// ── Tokens elementaires ───────────────────────────────────────────────────────
Deno.test("formatDurationToken : multiple de 60 en Nm, combine NmMs, secondes Ns", () => {
  assertEquals(formatDurationToken(1200), "20m")
  assertEquals(formatDurationToken(600), "10m")
  assertEquals(formatDurationToken(100), "1m40s")
  assertEquals(formatDurationToken(90), "1m30s")
  assertEquals(formatDurationToken(40), "40s")
  assertEquals(formatDurationToken(30), "30s")
})

Deno.test("formatDistanceToken : km si multiple de 1000, sinon metres en mtr", () => {
  assertEquals(formatDistanceToken(1000), "1km")
  assertEquals(formatDistanceToken(2000), "2km")
  assertEquals(formatDistanceToken(400), "400mtr")
  assertEquals(formatDistanceToken(600), "600mtr")
  assertEquals(formatDistanceToken(1500), "1500mtr")
})

Deno.test("formatPace : secondes par km en mm:ss", () => {
  assertEquals(formatPace(230), "3:50")
  assertEquals(formatPace(332), "5:32")
})

Deno.test("paceTarget : plage avec suffixe Pace, valeur seule sans tolerance, libre sinon", () => {
  assertEquals(paceTarget(230, 5), "3:45-3:55/km Pace")
  assertEquals(paceTarget(230, null), "3:50/km Pace")
  assertEquals(paceTarget(230, 0), "3:50/km Pace")
  assertEquals(paceTarget(null, 5), null)
})

Deno.test("sizeToken : distance prioritaire, sinon duree, sinon null", () => {
  assertEquals(sizeToken(step({ distance_m: 1000 })), "1km")
  assertEquals(sizeToken(step({ duration_sec: 600 })), "10m")
  assertEquals(sizeToken(step({})), null)
})

// ── Step en distance ──────────────────────────────────────────────────────────
Deno.test("step en distance : borne en km + allure ciblee avec Pace", () => {
  const s = step({ step_type: "run", distance_m: 5000, target_pace_sec: 270, pace_tolerance_sec: 5 })
  assertEquals(buildWorkoutDescription([s]), "- 5km 4:25-4:35/km Pace")
})

Deno.test("step en distance metres non multiple de 1000 : suffixe mtr", () => {
  const s = step({ step_type: "interval", distance_m: 600, target_pace_sec: 230, pace_tolerance_sec: 5 })
  const desc = buildWorkoutDescription([s])
  assert(desc.includes("600mtr"), desc)
})

// ── Step en duree combinee ────────────────────────────────────────────────────
Deno.test("step de recuperation en 1m40s sans allure (libre)", () => {
  const s = step({ step_type: "recovery", duration_sec: 100 })
  assertEquals(buildWorkoutDescription([s]), "- Recuperation 1m40s")
})

// ── Bloc repete + workout de reference ────────────────────────────────────────
// Steps aplatis tels que produits par expand.ts : echauffement, 5 intervalles
// + 4 recuperations intercalees (meme repeat_group), retour au calme.
const refSteps = (): PlanStep[] => {
  const steps: PlanStep[] = []
  let oi = 0
  steps.push(step({ order_index: oi++, step_type: "warmup", duration_sec: 1200, target_pace_sec: 344, pace_tolerance_sec: 12 }))
  for (let r = 1; r <= 5; r++) {
    steps.push(step({ order_index: oi++, step_type: "interval", repeat_group: 1, repeat_index: r, distance_m: 1000, target_pace_sec: 230, pace_tolerance_sec: 5 }))
    if (r < 5) steps.push(step({ order_index: oi++, step_type: "recovery", repeat_group: 1, repeat_index: r, duration_sec: 100 }))
  }
  steps.push(step({ order_index: oi++, step_type: "cooldown", duration_sec: 600, target_pace_sec: 344, pace_tolerance_sec: 12 }))
  return steps
}

const REF_DESCRIPTION = [
  "- Echauffement 20m 5:32-5:56/km Pace",
  "",
  "Fractionne 5x",
  "- 1km 3:45-3:55/km Pace",
  "- Recuperation 1m40s",
  "",
  "- Retour au calme 10m 5:32-5:56/km Pace",
].join("\n")

Deno.test("groupByRepeat : reconstruit un bloc de 5 depuis les steps aplatis", () => {
  const items = groupByRepeat(refSteps())
  const repeat = items.find((it) => it.kind === "repeat")
  assert(repeat && repeat.kind === "repeat")
  if (repeat.kind === "repeat") {
    assertEquals(repeat.count, 5)
    assertEquals(repeat.interval.distance_m, 1000)
    assertEquals(repeat.recovery?.duration_sec, 100)
  }
})

Deno.test("workout de reference : sortie exacte attendue", () => {
  assertEquals(buildWorkoutDescription(refSteps()), REF_DESCRIPTION)
})

Deno.test("bloc repete : une ligne vide AVANT et APRES l'en-tete Nx", () => {
  const desc = buildWorkoutDescription(refSteps())
  const lines = desc.split("\n")
  const headerIdx = lines.indexOf("Fractionne 5x")
  assert(headerIdx > 0, "en-tete de bloc absent")
  assertEquals(lines[headerIdx - 1], "", "ligne vide manquante avant le bloc")
  // Dernier step du bloc = la recuperation, suivie d'une ligne vide.
  const recIdx = lines.indexOf("- Recuperation 1m40s")
  assertEquals(lines[recIdx + 1], "", "ligne vide manquante apres le bloc")
})

Deno.test("suffixe Pace present sur chaque step qui a une allure cible", () => {
  const lines = buildWorkoutDescription(refSteps()).split("\n").filter((l) => l.startsWith("- "))
  // Echauffement, intervalle et retour au calme ont une allure ; recup non.
  assertEquals(lines.filter((l) => l.includes("/km Pace")).length, 3)
  const rec = lines.find((l) => l.startsWith("- Recuperation"))
  assert(rec && !rec.includes("Pace"), "la recuperation ne doit porter aucune allure")
})

// ── Aucune indentation nulle part ─────────────────────────────────────────────
Deno.test("aucune ligne indentee dans la description", () => {
  const desc = buildWorkoutDescription(refSteps())
  assert(!desc.split("\n").some((l) => l.startsWith(" ")), "une ligne est indentee")
})
