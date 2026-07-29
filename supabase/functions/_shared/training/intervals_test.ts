// Tests du mapping steps -> description Intervals.icu. Fonctions pures, aucune
// I/O. Execution : deno test intervals_test.ts
import { assertEquals } from "jsr:@std/assert@1"
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
Deno.test("formatDurationToken : secondes, minutes, heures et combinaisons", () => {
  assertEquals(formatDurationToken(45), "45s")
  assertEquals(formatDurationToken(90), "1m30s")
  assertEquals(formatDurationToken(600), "10m")
  assertEquals(formatDurationToken(3600), "1h")
  assertEquals(formatDurationToken(3930), "1h5m30s")
  assertEquals(formatDurationToken(0), "0s")
})

Deno.test("formatDistanceToken : metres sous 1 km, km au dela (zeros retires)", () => {
  assertEquals(formatDistanceToken(400), "400m")
  assertEquals(formatDistanceToken(1000), "1km")
  assertEquals(formatDistanceToken(1500), "1.5km")
  assertEquals(formatDistanceToken(1200), "1.2km")
})

Deno.test("formatPace : secondes par km en mm:ss", () => {
  assertEquals(formatPace(250), "4:10")
  assertEquals(formatPace(305), "5:05")
})

Deno.test("paceTarget : plage avec tolerance, valeur seule sans, libre si pas d'allure", () => {
  assertEquals(paceTarget(250, 5), "4:05-4:15/km")
  assertEquals(paceTarget(250, null), "4:10/km")
  assertEquals(paceTarget(250, 0), "4:10/km")
  assertEquals(paceTarget(null, 5), null)
})

Deno.test("sizeToken : distance prioritaire, sinon duree, sinon null", () => {
  assertEquals(sizeToken(step({ distance_m: 1000 })), "1km")
  assertEquals(sizeToken(step({ duration_sec: 600 })), "10m")
  assertEquals(sizeToken(step({})), null)
})

// ── Step en distance ──────────────────────────────────────────────────────────
Deno.test("step en distance : borne en km + allure ciblee", () => {
  const s = step({ step_type: "run", distance_m: 5000, target_pace_sec: 270, pace_tolerance_sec: 5 })
  assertEquals(buildWorkoutDescription([s]), "- 5km 4:25-4:35/km")
})

// ── Step en duree ─────────────────────────────────────────────────────────────
Deno.test("step en duree : echauffement en minutes sans allure (libre)", () => {
  const s = step({ step_type: "warmup", duration_sec: 900 })
  assertEquals(buildWorkoutDescription([s]), "- 15m")
})

// ── Step de recuperation sans allure ──────────────────────────────────────────
Deno.test("step de recuperation sans allure cible : ligne sans allure", () => {
  const s = step({ step_type: "recovery", duration_sec: 90 })
  assertEquals(buildWorkoutDescription([s]), "- 1m30s")
})

// ── Bloc repete ───────────────────────────────────────────────────────────────
// Steps aplatis tels que produits par expand.ts : 3 intervalles + 2 recuperations
// intercalees (pas de recup apres la derniere), meme repeat_group.
const repeatFixture = (): PlanStep[] => [
  step({ order_index: 0, step_type: "interval", repeat_group: 1, repeat_index: 1, distance_m: 1000, target_pace_sec: 250, pace_tolerance_sec: 5 }),
  step({ order_index: 1, step_type: "recovery", repeat_group: 1, repeat_index: 1, duration_sec: 90 }),
  step({ order_index: 2, step_type: "interval", repeat_group: 1, repeat_index: 2, distance_m: 1000, target_pace_sec: 250, pace_tolerance_sec: 5 }),
  step({ order_index: 3, step_type: "recovery", repeat_group: 1, repeat_index: 2, duration_sec: 90 }),
  step({ order_index: 4, step_type: "interval", repeat_group: 1, repeat_index: 3, distance_m: 1000, target_pace_sec: 250, pace_tolerance_sec: 5 }),
]

Deno.test("groupByRepeat : reconstruit un bloc de 3 depuis les steps aplatis", () => {
  const items = groupByRepeat(repeatFixture())
  assertEquals(items.length, 1)
  assertEquals(items[0].kind, "repeat")
  if (items[0].kind === "repeat") {
    assertEquals(items[0].count, 3)
    assertEquals(items[0].interval.distance_m, 1000)
    assertEquals(items[0].recovery?.duration_sec, 90)
  }
})

Deno.test("bloc repete : syntaxe Nx avec intervalle et recuperation indentes", () => {
  assertEquals(
    buildWorkoutDescription(repeatFixture()),
    "3x\n  - 1km 4:05-4:15/km\n  - 1m30s",
  )
})

// ── Workout complet (echauffement + bloc + retour au calme) ───────────────────
Deno.test("workout complet : echauffement, bloc repete, retour au calme", () => {
  const steps: PlanStep[] = [
    step({ order_index: 0, step_type: "warmup", duration_sec: 900 }),
    ...repeatFixture().map((s, i) => ({ ...s, order_index: i + 1 })),
    step({ order_index: 6, step_type: "cooldown", duration_sec: 600 }),
  ]
  assertEquals(
    buildWorkoutDescription(steps),
    ["- 15m", "3x", "  - 1km 4:05-4:15/km", "  - 1m30s", "- 10m"].join("\n"),
  )
})
