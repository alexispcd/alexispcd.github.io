// Tests de l'appariement steps <-> laps (match.ts), en données figées, sans
// réseau. Cas de référence : séance du 20 juillet 2026 (6x600m précédée d'un
// footing) enregistrée en DEUX activités Coros, concaténées côté serveur.
//
// Lancer : deno test supabase/functions/complete-session/match.test.ts

import { filterLaps, type Lap, matchStepsToLaps, type Step } from "./match.ts"

// ── Mini utilitaires d'assertion (aucune dépendance externe) ──────────────────
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion échouée : ${msg}`)
}
function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) throw new Error(`${msg} : attendu ${expected}, obtenu ${actual}`)
}

// ── Constructeurs concis ──────────────────────────────────────────────────────
let orderCounter = 0
const step = (
  step_type: string,
  opts: Partial<Omit<Step, "step_type" | "order_index">> = {},
): Step => ({
  order_index: orderCounter++,
  step_type,
  target_pace_sec: opts.target_pace_sec ?? null,
  pace_tolerance_sec: opts.pace_tolerance_sec ?? null,
  distance_m: opts.distance_m ?? null,
  duration_sec: opts.duration_sec ?? null,
})
const lap = (distance_m: number, duration_sec: number, avg_pace_sec: number | null, avg_hr: number | null = null): Lap => ({
  distance_m,
  duration_sec,
  avg_pace_sec,
  avg_hr,
})

// ── Séance de référence : 13 steps ────────────────────────────────────────────
// warmup 1200 s (cible 344 ±12), 6x600 m (cible 225 ±5) séparés de 5 récup 90 s
// sans cible, puis cooldown 600 s (cible 344 ±12).
const buildSteps = (): Step[] => {
  orderCounter = 0
  const s: Step[] = [step("warmup", { duration_sec: 1200, target_pace_sec: 344, pace_tolerance_sec: 12 })]
  for (let i = 0; i < 6; i++) {
    s.push(step("interval", { distance_m: 600, target_pace_sec: 225, pace_tolerance_sec: 5 }))
    if (i < 5) s.push(step("recovery", { duration_sec: 90 }))
  }
  s.push(step("cooldown", { duration_sec: 600, target_pace_sec: 344, pace_tolerance_sec: 12 }))
  return s
}

// Activité 1 (Vannes Course, footing d'échauffement) : 4 laps auto-km, footing
// progressif. Chaque lap est individuellement hors cible warmup, mais leur somme
// (1204 s pour 3510 m, soit 343 s/km) tombe dans la cible.
const activity1Laps = (): Lap[] => [
  lap(1000, 360, 360, 140),
  lap(1000, 345, 345, 142),
  lap(1000, 330, 330, 145),
  lap(510, 169, 331, 146),
]

// Activité 2 (workout 6x600m) : intervalles et récup programmés, plus trois laps
// parasites (21,4 m ; 16,7 m ; un lap de 7 s) et un petit lap conservé (107,7 m
// en 27 s). Deltas visés sur les 600 m : +2, +2, 0, +5, +3, -2.
const activity2Laps = (): Lap[] => [
  lap(21.4, 8, null, null), // parasite : distance < 50 m
  lap(600, 136, 227, 165), // interval 1 : +2
  lap(250, 90, 360, 150), // récup 1
  lap(600, 136, 227, 166), // interval 2 : +2
  lap(250, 90, 360, 150), // récup 2
  lap(600, 135, 225, 167), // interval 3 : 0
  lap(250, 90, 360, 151), // récup 3
  lap(600, 138, 230, 168), // interval 4 : +5
  lap(250, 90, 360, 151), // récup 4
  lap(600, 137, 228, 169), // interval 5 : +3
  lap(250, 90, 360, 152), // récup 5
  lap(600, 134, 223, 170), // interval 6 : -2
  lap(16.7, 5, null, null), // parasite : distance < 50 m
  lap(1600, 620, 388, 150), // cooldown : hors cible (+44)
  lap(60, 7, 117, null), // parasite : durée < 15 s
  lap(107.7, 27, 251, 140), // petit lap conservé (>= 50 m et >= 15 s)
]

const nStatus = (comparisons: { status: string }[], status: string) =>
  comparisons.filter((c) => c.status === status).length

// ── Test principal : ordre chronologique + agrégation + filtrage ──────────────
Deno.test("séance à deux activités : ordre chronologique, 6 intervalles ok", () => {
  const steps = buildSteps()
  // Concaténation chronologique : footing (activité 1) puis workout (activité 2).
  const laps = [...activity1Laps(), ...activity2Laps()]
  const { comparisons } = matchStepsToLaps(steps, laps)

  // Les 6 steps d'intervalle (step_index impairs 1,3,5,7,9,11) sont tous 'ok'.
  const intervalSteps = [1, 3, 5, 7, 9, 11]
  const intervalCmps = intervalSteps.map((si) => comparisons.find((c) => c.step_index === si))
  for (const c of intervalCmps) {
    assert(c, "comparaison d'intervalle manquante")
    assertEquals(c!.status, "ok", `intervalle step ${c!.step_index}`)
  }
  assertEquals(intervalCmps.filter((c) => c!.status === "ok").length, 6, "intervalles ok")
})

Deno.test("agrégation : le warmup passe 'ok' (7/8), durée agrégée 1204 s", () => {
  const steps = buildSteps()
  const laps = [...activity1Laps(), ...activity2Laps()]
  const { comparisons, actualLaps } = matchStepsToLaps(steps, laps)

  // Warmup (step 0) agrégé sur 4 laps → 'ok'.
  const warmup = comparisons.find((c) => c.step_index === 0)
  assert(warmup, "comparaison warmup manquante")
  assertEquals(warmup!.status, "ok", "warmup agrégé")
  assertEquals(warmup!.lap_count, 4, "nombre de laps agrégés au warmup")

  // 8 steps notés (warmup + 6 intervalles + cooldown), les récup sont 'free'.
  const graded = comparisons.filter((c) => c.status !== "free")
  assertEquals(graded.length, 8, "steps notés")
  assertEquals(nStatus(comparisons, "ok"), 7, "steps ok (warmup + 6 intervalles)")

  // Durée agrégée des laps du warmup (step_index 0) = 1204 s pour 1200 prévues.
  const warmupDuration = actualLaps
    .filter((l) => l.step_index === 0)
    .reduce((sum, l) => sum + (l.duration_sec ?? 0), 0)
  assertEquals(warmupDuration, 1204, "durée agrégée du warmup")
  // Le step_index est renseigné sur TOUS les laps du groupe, pas seulement le 1er.
  assertEquals(actualLaps.filter((l) => l.step_index === 0).length, 4, "laps portant le step_index 0")
})

Deno.test("filtrage : les laps parasites sont écartés, le petit lap valide conservé", () => {
  const raw = [...activity1Laps(), ...activity2Laps()]
  const filtered = filterLaps(raw)

  const has = (dist: number, dur: number) =>
    filtered.some((l) => l.distance_m === dist && l.duration_sec === dur)

  assert(!has(21.4, 8), "le lap de 21,4 m doit être écarté")
  assert(!has(16.7, 5), "le lap de 16,7 m doit être écarté")
  assert(!has(60, 7), "le lap de 7 s doit être écarté")
  assert(has(107.7, 27), "le lap de 107,7 m en 27 s doit être conservé")

  // Cohérence : les laps écartés n'apparaissent pas non plus dans actual_laps.
  const steps = buildSteps()
  const { actualLaps } = matchStepsToLaps(steps, raw)
  assert(!actualLaps.some((l) => l.distance_m === 21.4), "actual_laps ne doit pas contenir le lap 21,4 m")
  assert(!actualLaps.some((l) => l.distance_m === 16.7), "actual_laps ne doit pas contenir le lap 16,7 m")
  assert(actualLaps.some((l) => l.distance_m === 107.7), "actual_laps doit contenir le lap 107,7 m")
})

// ── Non régression : séance à une seule activité, appariement 1:1 inchangé ─────
Deno.test("non régression : une seule activité, appariement 1:1 préservé", () => {
  orderCounter = 0
  const steps: Step[] = [
    step("warmup", { duration_sec: 600, target_pace_sec: 340, pace_tolerance_sec: 12 }),
    step("interval", { distance_m: 600, target_pace_sec: 225, pace_tolerance_sec: 5 }),
    step("recovery", { duration_sec: 90 }),
    step("interval", { distance_m: 600, target_pace_sec: 225, pace_tolerance_sec: 5 }),
    step("cooldown", { duration_sec: 300, target_pace_sec: 340, pace_tolerance_sec: 12 }),
  ]
  // Workout enregistré exactement comme programmé : autant de laps que de steps.
  const laps: Lap[] = [
    lap(1765, 600, 340, 138),
    lap(600, 135, 225, 165),
    lap(250, 90, 360, 148),
    lap(600, 135, 225, 166),
    lap(880, 300, 341, 150),
  ]
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps)

  // Appariement identité : lap i -> step i, aucun regroupement.
  for (let i = 0; i < laps.length; i++) {
    assertEquals(actualLaps[i].step_index, i, `lap ${i} rattaché au step ${i}`)
  }
  for (const c of comparisons) {
    assertEquals(c.lap_count, 1, `step ${c.step_index} non agrégé`)
  }
  assertEquals(comparisons.find((c) => c.step_index === 0)!.status, "ok", "warmup")
  assertEquals(comparisons.find((c) => c.step_index === 4)!.status, "ok", "cooldown")
  assertEquals(nStatus(comparisons, "ok"), 4, "steps ok (warmup + 2 intervalles + cooldown)")
  assertEquals(nStatus(comparisons, "free"), 1, "récup libre")
})
