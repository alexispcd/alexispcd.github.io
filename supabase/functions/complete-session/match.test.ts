// Tests de l'appariement steps <-> laps (match.ts), en données figées, sans
// réseau.
//
// Cas de référence : séance du 20 juillet 2026 (footing + 6x600m) enregistrée en
// DEUX activités Coros et concaténée côté serveur. Données réelles de production
// (séance 27e39a56-9866-421e-9052-eada688e3b2c). Ce test appelle matchStepsToLaps
// avec la liste COMPLÈTE de laps et vérifie l'appariement de TOUS les steps, pas
// seulement la durée agrégée, pour détecter un mauvais choix de lap de départ.
//
// Lancer : deno test supabase/functions/complete-session/match.test.ts

import { type Lap, matchStepsToLaps, type Step } from "./match.ts"

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
// Allure = durée / distance, mise à null hors bornes 2:00 à 15:00/km (comme
// mapLap en prod). L'agrégation la recalcule sur les totaux.
const lap = (distance_m: number, duration_sec: number, avg_hr: number | null = null): Lap => {
  const pace = Math.round(duration_sec / (distance_m / 1000))
  return {
    distance_m,
    duration_sec,
    avg_pace_sec: pace >= 120 && pace <= 900 ? pace : null,
    avg_hr,
  }
}

const laps = (pairs: [number, number][]): Lap[] => pairs.map(([d, t]) => lap(d, t))

/** Index des laps rattachés au step si. */
const lapsOf = (actualLaps: { lap_index: number; step_index: number | null }[], si: number): number[] =>
  actualLaps.filter((l) => l.step_index === si).map((l) => l.lap_index)

// 14 steps : warmup 1200 s (cible 344 ±12), 6x600 m (cible 225 ±5) chacun suivi
// d'une récup 90 s sans cible (y compris apres le 6e intervalle), puis cooldown
// 600 s (cible 344 ±12).
const buildRefSteps = (): Step[] => {
  orderCounter = 0
  const s: Step[] = [step("warmup", { duration_sec: 1200, target_pace_sec: 344, pace_tolerance_sec: 12 })]
  for (let i = 0; i < 6; i++) {
    s.push(step("interval", { distance_m: 600, target_pace_sec: 225, pace_tolerance_sec: 5 }))
    s.push(step("recovery", { duration_sec: 90 }))
  }
  s.push(step("cooldown", { duration_sec: 600, target_pace_sec: 344, pace_tolerance_sec: 12 }))
  return s
}

// Laps réels concaténés dans l'ordre chronologique (distance_m, duration_sec).
// Laps 0 a 4 : footing d'échauffement (lap 4 : 107 m, fin de la 1re activité,
// les intervalles démarrent la 2e au lap 5). Laps 5 a 16 :
// intervalles et récup (la récup 6 au lap 16 est bien courue). Lap 17 : cooldown
// enregistré en un seul lap trop long.
const buildRefLaps = (): Lap[] => [
  lap(1000, 353), // 0
  lap(1000, 381), // 1
  lap(1000, 339), // 2
  lap(390.02, 131), // 3
  lap(107.74, 27), // 4
  lap(600, 136), // 5  interval 1 : +2
  lap(252.77, 90), // 6  récup 1
  lap(600, 136), // 7  interval 2 : +2
  lap(264.57, 90), // 8  récup 2
  lap(600, 135), // 9  interval 3 : 0
  lap(251.55, 90), // 10 récup 3
  lap(600, 138), // 11 interval 4 : +5
  lap(254.43, 90), // 12 récup 4
  lap(600, 137), // 13 interval 5 : +3
  lap(196.98, 90), // 14 récup 5
  lap(600, 134), // 15 interval 6 : -2
  lap(188.87, 90), // 16 récup 6
  lap(1517.51, 737), // 17 cooldown
]

// ── Test principal : deux activités, appariement complet ─────────────────────
Deno.test("cas réel : deux activités, appariement complet step par step", () => {
  const steps = buildRefSteps()
  const laps = buildRefLaps()
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps, [0, 5])

  const cmp = new Map(comparisons.map((c) => [c.step_index, c]))
  const get = (si: number) => {
    const c = cmp.get(si)
    assert(c, `comparaison du step ${si} manquante`)
    return c!
  }

  // step 0 : warmup agrégé sur les 5 premiers laps, lap 4 compris.
  const c0 = get(0)
  assertEquals(c0.lap_index, 0, "step0 lap de départ")
  assertEquals(c0.lap_count, 5, "step0 nombre de laps")
  assertEquals(c0.actual_pace, 352, "step0 allure agrégée")
  assertEquals(c0.delta_sec, 8, "step0 delta")
  assertEquals(c0.status, "ok", "step0 statut")

  // Durée + distance agrégées reconstituées depuis actual_laps.
  const warmupLaps = actualLaps.filter((l) => l.step_index === 0)
  assertEquals(warmupLaps.length, 5, "step0 : 5 laps portent le step_index 0")
  assertEquals(warmupLaps.reduce((s, l) => s + (l.duration_sec ?? 0), 0), 1231, "step0 durée agrégée")
  const dist = Math.round(warmupLaps.reduce((s, l) => s + (l.distance_m ?? 0), 0) * 100) / 100
  assertEquals(dist, 3497.76, "step0 distance agrégée")

  // Intervalles : appariés 1:1 sur les 600 m, tous dans la cible.
  // [step_index, lap_index, allure, delta]
  const intervals: [number, number, number, number][] = [
    [1, 5, 227, 2],
    [3, 7, 227, 2],
    [5, 9, 225, 0],
    [7, 11, 230, 5],
    [9, 13, 228, 3],
    [11, 15, 223, -2],
  ]
  for (const [si, lapIdx, pace, delta] of intervals) {
    const c = get(si)
    assertEquals(c.lap_index, lapIdx, `step${si} lap de départ`)
    assertEquals(c.lap_count, 1, `step${si} nombre de laps`)
    assertEquals(c.actual_pace, pace, `step${si} allure`)
    assertEquals(c.delta_sec, delta, `step${si} delta`)
    assertEquals(c.status, "ok", `step${si} statut`)
  }

  // Récup : 'free', appariées 1:1. La 6e récup (step 12) capte le lap 16.
  for (const [si, lapIdx] of [[2, 6], [4, 8], [6, 10], [8, 12], [10, 14], [12, 16]]) {
    const c = get(si)
    assertEquals(c.lap_index, lapIdx, `step${si} lap de départ`)
    assertEquals(c.lap_count, 1, `step${si} nombre de laps`)
    assertEquals(c.status, "free", `step${si} statut`)
  }

  // Cooldown : lap 17, hors cible.
  const c13 = get(13)
  assertEquals(c13.lap_index, 17, "step13 lap de départ")
  assertEquals(c13.lap_count, 1, "step13 nombre de laps")
  assertEquals(c13.actual_pace, 486, "step13 allure")
  assertEquals(c13.delta_sec, 142, "step13 delta")
  assertEquals(c13.status, "ecart", "step13 statut")

  // Total : 7 comparaisons ok sur les 8 steps ayant une cible.
  const graded = comparisons.filter((c) => c.status !== "free")
  assertEquals(graded.length, 8, "steps ayant une cible")
  assertEquals(graded.filter((c) => c.status === "ok").length, 7, "steps ok")

  // Plus aucun lap orphelin : le lap 4 est rattaché au warmup.
  for (const l of actualLaps) assert(l.step_index != null, `lap ${l.lap_index} orphelin`)
  assertEquals(actualLaps[4].step_index, 0, "lap 4 rattaché au warmup")
  assertEquals(actualLaps[16].step_index, 12, "lap 16 rattaché à la 6e récup")
})

// ── Séance du 14/10 (données réelles) : 1:1, fraction très courte conservée ───
Deno.test("cas réel 14/10 : appariement 1:1, la 3e fraction de 42 m est conservée", () => {
  orderCounter = 0
  const steps: Step[] = [step("warmup", { duration_sec: 900, target_pace_sec: 350, pace_tolerance_sec: 12 })]
  for (let i = 0; i < 3; i++) {
    steps.push(step("interval", { duration_sec: 480, target_pace_sec: 257, pace_tolerance_sec: 5 }))
    steps.push(step("recovery", { duration_sec: 120 }))
  }
  steps.push(step("cooldown", { duration_sec: 600, target_pace_sec: 355, pace_tolerance_sec: 12 }))
  const ls = laps([
    [2582.66, 900],
    [1904.32, 480],
    [301.97, 120],
    [1913.17, 480],
    [343.33, 120],
    [42.26, 17],
    [324.43, 120],
    [1520.27, 551],
  ])
  const { actualLaps, comparisons } = matchStepsToLaps(steps, ls)

  assertEquals(actualLaps.length, 8, "aucun lap écarté")
  for (let i = 0; i < 8; i++) assertEquals(actualLaps[i].step_index, i, `lap ${i} rattaché au step ${i}`)
  const c5 = comparisons.find((c) => c.step_index === 5)
  assert(c5, "comparaison du step 5 manquante")
  assertEquals(c5.lap_index, 5, "step5 lap")
  assertEquals(c5.lap_count, 1, "step5 nombre de laps")
  assertEquals(c5.actual_pace, 402, "step5 allure")
})

// ── Séance du 26/08 (données réelles) : pas de décalage d'un cran ─────────────
Deno.test("cas réel 26/08 : 1:1 sur les 11 premiers steps, cooldown sur 2 laps", () => {
  orderCounter = 0
  const steps: Step[] = [step("warmup", { duration_sec: 1200, target_pace_sec: 340, pace_tolerance_sec: 12 })]
  for (let i = 0; i < 5; i++) {
    steps.push(step("interval", { distance_m: 2000, target_pace_sec: 234, pace_tolerance_sec: 5 }))
    steps.push(step("recovery", { duration_sec: 105 }))
  }
  steps.push(step("cooldown", { duration_sec: 600, target_pace_sec: 340, pace_tolerance_sec: 12 }))
  const ls = laps([
    [2693.8, 914],
    [1000, 240],
    [282.14, 120],
    [1000, 236],
    [266.07, 120],
    [1000, 236],
    [234.81, 120],
    [1000, 233],
    [69.95, 120],
    [1000, 220],
    [165.8, 120],
    [1640.52, 600],
    [495.21, 177],
  ])
  const { actualLaps, comparisons } = matchStepsToLaps(steps, ls)

  for (let i = 0; i <= 10; i++) assertEquals(actualLaps[i].step_index, i, `lap ${i} rattaché au step ${i}`)
  assertEquals(lapsOf(actualLaps, 11).join(","), "11,12", "cooldown sur les laps 11 et 12")
  const c11 = comparisons.find((c) => c.step_index === 11)
  assert(c11, "comparaison du cooldown manquante")
  assertEquals(c11.lap_index, 11, "cooldown lap de départ")
  assertEquals(c11.lap_count, 2, "cooldown nombre de laps")
})

// ── Lap de pause final : rattaché au cooldown sans fausser son allure ─────────
Deno.test("lap de pause final : rattaché au cooldown, allure calculée sans lui", () => {
  orderCounter = 0
  const steps: Step[] = [
    step("warmup", { duration_sec: 600 }),
    step("interval", { distance_m: 1000 }),
    step("recovery", { duration_sec: 90 }),
    step("cooldown", { duration_sec: 300, target_pace_sec: 353, pace_tolerance_sec: 12 }),
  ]
  const ls = laps([[1700, 600], [1000, 230], [250, 90], [850, 300], [20, 60]])
  const { actualLaps, comparisons } = matchStepsToLaps(steps, ls)

  assertEquals(lapsOf(actualLaps, 3).join(","), "3,4", "cooldown sur les laps 3 et 4")
  const duration = lapsOf(actualLaps, 3).reduce((s, i) => s + (actualLaps[i].duration_sec ?? 0), 0)
  assertEquals(duration, 360, "cooldown durée agrégée")
  const c3 = comparisons.find((c) => c.step_index === 3)
  assert(c3, "comparaison du cooldown manquante")
  assertEquals(c3.actual_pace, 353, "cooldown allure sans le lap de pause")
  assertEquals(c3.status, "ok", "cooldown statut")
})

// ── Dernier step fraction : les laps superflus de fin lui reviennent ──────────
Deno.test("dernier step fraction : absorbe le lap superflu de fin", () => {
  orderCounter = 0
  const steps: Step[] = [step("warmup", { duration_sec: 600 }), step("interval", { distance_m: 1000 })]
  const { actualLaps } = matchStepsToLaps(steps, laps([[1700, 600], [1000, 230], [200, 60]]))

  assertEquals(lapsOf(actualLaps, 0).join(","), "0", "warmup sur le lap 0")
  assertEquals(lapsOf(actualLaps, 1).join(","), "1,2", "interval sur les laps 1 et 2")
})

// ── Jonction entre deux activités : une fraction peut la chevaucher ───────────
Deno.test("jonction : fraction coupée par un redémarrage de montre", () => {
  const build = (): Step[] => {
    orderCounter = 0
    return [
      step("warmup", { duration_sec: 600 }),
      step("interval", { distance_m: 1000 }),
      step("recovery", { duration_sec: 90 }),
      step("cooldown", { duration_sec: 300 }),
    ]
  }
  const pairs: [number, number][] = [[1700, 600], [400, 92], [600, 138], [250, 90], [850, 300]]

  const withJunction = matchStepsToLaps(build(), laps(pairs), [0, 2])
  assertEquals(lapsOf(withJunction.actualLaps, 1).join(","), "1,2", "avec jonction : interval sur les laps 1 et 2")

  const without = matchStepsToLaps(build(), laps(pairs), [0])
  assertEquals(lapsOf(without.actualLaps, 1).join(","), "2", "sans jonction : interval sur le seul lap 2")
  assertEquals(lapsOf(without.actualLaps, 0).join(","), "0,1", "sans jonction : le lap 1 part dans le warmup")
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
    lap(1765, 600),
    lap(600, 135),
    lap(250, 90),
    lap(600, 135),
    lap(880, 300),
  ]
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps)

  // Appariement identité : lap i -> step i, aucun regroupement.
  for (let i = 0; i < laps.length; i++) {
    assertEquals(actualLaps[i].step_index, i, `lap ${i} rattaché au step ${i}`)
  }
  for (const c of comparisons) {
    assertEquals(c.lap_count, 1, `step ${c.step_index} non agrégé`)
  }
  const cmp = new Map(comparisons.map((c) => [c.step_index, c]))
  assertEquals(cmp.get(0)!.status, "ok", "warmup")
  assertEquals(cmp.get(4)!.status, "ok", "cooldown")
  assertEquals(comparisons.filter((c) => c.status === "ok").length, 4, "steps ok")
  assertEquals(comparisons.filter((c) => c.status === "free").length, 1, "récup libre")
})
