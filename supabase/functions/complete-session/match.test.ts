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
// Allure = durée / distance (recalculée comme en prod). Sert uniquement à peupler
// avg_pace_sec des laps unitaires ; l'agrégation la recalcule sur les totaux.
const lap = (distance_m: number, duration_sec: number, avg_hr: number | null = null): Lap => ({
  distance_m,
  duration_sec,
  avg_pace_sec: Math.round(duration_sec / (distance_m / 1000)),
  avg_hr,
})

// 13 steps : warmup 1200 s (cible 344 ±12), 6x600 m (cible 225 ±5) séparés de 5
// récup 90 s sans cible, puis cooldown 600 s (cible 344 ±12).
const buildRefSteps = (): Step[] => {
  orderCounter = 0
  const s: Step[] = [step("warmup", { duration_sec: 1200, target_pace_sec: 344, pace_tolerance_sec: 12 })]
  for (let i = 0; i < 6; i++) {
    s.push(step("interval", { distance_m: 600, target_pace_sec: 225, pace_tolerance_sec: 5 }))
    if (i < 5) s.push(step("recovery", { duration_sec: 90 }))
  }
  s.push(step("cooldown", { duration_sec: 600, target_pace_sec: 344, pace_tolerance_sec: 12 }))
  return s
}

// Laps réels concaténés dans l'ordre chronologique (distance_m, duration_sec).
// Laps 0 a 3 : footing d'échauffement. Lap 4 : artefact (107 m). Laps 5 a 15 :
// intervalles et récup. Lap 16 : artefact (188 m). Lap 17 : cooldown enregistré
// en un seul lap trop long.
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
  lap(188.87, 90), // 16 artefact
  lap(1517.51, 737), // 17 cooldown
]

// ── Test principal : optimisation conjointe, appariement complet ──────────────
Deno.test("cas réel : départ conjoint, appariement complet step par step", () => {
  const steps = buildRefSteps()
  const laps = buildRefLaps()
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps)

  const cmp = new Map(comparisons.map((c) => [c.step_index, c]))
  const get = (si: number) => {
    const c = cmp.get(si)
    assert(c, `comparaison du step ${si} manquante`)
    return c!
  }

  // step 0 : warmup agrégé sur les 4 premiers laps (départ 0, PAS 1).
  const c0 = get(0)
  assertEquals(c0.lap_index, 0, "step0 lap de départ")
  assertEquals(c0.lap_count, 4, "step0 nombre de laps")
  assertEquals(c0.actual_pace, 355, "step0 allure agrégée")
  assertEquals(c0.delta_sec, 11, "step0 delta")
  assertEquals(c0.status, "ok", "step0 statut")

  // Durée + distance agrégées reconstituées depuis actual_laps.
  const warmupLaps = actualLaps.filter((l) => l.step_index === 0)
  assertEquals(warmupLaps.length, 4, "step0 : 4 laps portent le step_index 0")
  assertEquals(warmupLaps.reduce((s, l) => s + (l.duration_sec ?? 0), 0), 1204, "step0 durée agrégée")
  const dist = Math.round(warmupLaps.reduce((s, l) => s + (l.distance_m ?? 0), 0) * 100) / 100
  assertEquals(dist, 3390.02, "step0 distance agrégée")

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

  // Récup : 'free', appariées 1:1.
  for (const [si, lapIdx] of [[2, 6], [4, 8], [6, 10], [8, 12], [10, 14]]) {
    const c = get(si)
    assertEquals(c.lap_index, lapIdx, `step${si} lap de départ`)
    assertEquals(c.lap_count, 1, `step${si} nombre de laps`)
    assertEquals(c.status, "free", `step${si} statut`)
  }

  // Cooldown : lap 17 (le lap 16 est sauté), hors cible.
  const c12 = get(12)
  assertEquals(c12.lap_index, 17, "step12 lap de départ")
  assertEquals(c12.lap_count, 1, "step12 nombre de laps")
  assertEquals(c12.actual_pace, 486, "step12 allure")
  assertEquals(c12.delta_sec, 142, "step12 delta")
  assertEquals(c12.status, "ecart", "step12 statut")

  // Total : 7 comparaisons ok sur les 8 steps ayant une cible.
  const graded = comparisons.filter((c) => c.status !== "free")
  assertEquals(graded.length, 8, "steps ayant une cible")
  assertEquals(graded.filter((c) => c.status === "ok").length, 7, "steps ok")

  // Le lap 16 n'est apparié à aucun step (artefact sauté), c'est normal.
  assertEquals(actualLaps[16].step_index, null, "lap 16 orphelin")

  // GARDE ANTI RÉGRESSION du choix de départ : le premier step démarre au lap 0
  // et aucun lap d'index inférieur à ce départ ne reste orphelin. Si le départ
  // reglissait sur le lap 1 (bug corrigé), le lap 0 redeviendrait orphelin ici.
  const firstStart = c0.lap_index
  assertEquals(firstStart, 0, "le premier step démarre au lap 0")
  for (let i = 0; i < firstStart; i++) {
    assert(actualLaps[i].step_index != null, `lap ${i} (avant le premier step) ne doit pas être orphelin`)
  }
  assertEquals(actualLaps[0].step_index, 0, "lap 0 rattaché au warmup")
})

// ── Filtrage des laps parasites (correctif 2, non modifié) ────────────────────
Deno.test("filtrage : laps parasites écartés, petit lap valide conservé", () => {
  const raw: Lap[] = [
    lap(21.4, 8), // parasite : distance < 50 m
    lap(600, 136), // valide
    lap(16.7, 5), // parasite : distance < 50 m
    lap(60, 7), // parasite : durée < 15 s
    lap(107.7, 27), // conservé : >= 50 m et >= 15 s
  ]
  const filtered = filterLaps(raw)
  assertEquals(filtered.length, 2, "2 laps conservés")
  assert(!filtered.some((l) => l.distance_m === 21.4), "le lap de 21,4 m doit être écarté")
  assert(!filtered.some((l) => l.distance_m === 16.7), "le lap de 16,7 m doit être écarté")
  assert(!filtered.some((l) => l.duration_sec === 7), "le lap de 7 s doit être écarté")
  assert(filtered.some((l) => l.distance_m === 107.7), "le lap de 107,7 m en 27 s doit être conservé")
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
