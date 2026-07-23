// Matching steps ↔ laps et comparaison des allures. Tout est calculé en code,
// aucune décision déléguée à l'IA.

export interface Step {
  order_index: number
  step_type: string
  target_pace_sec: number | null
  pace_tolerance_sec: number | null
  distance_m: number | null
  duration_sec: number | null
}

export interface Lap {
  distance_m: number | null
  duration_sec: number | null
  avg_pace_sec: number | null
  avg_hr: number | null
}

export interface ActualLap {
  lap_index: number
  step_index: number | null
  distance_m: number | null
  duration_sec: number | null
  avg_pace_sec: number | null
  avg_hr: number | null
}

export interface Comparison {
  step_index: number
  lap_index: number // index du premier lap du groupe (agrégé ou non)
  lap_count: number // nombre de laps agrégés dans ce step (1 hors agrégation)
  planned_pace: number | null
  actual_pace: number | null
  delta_sec: number | null
  status: "ok" | "proche" | "ecart" | "free"
}

/**
 * Seuils de rejet des laps parasites : artefacts de montre (pause GPS, appui
 * accidentel sur le bouton lap). Un lap sous 50 m OU sous 15 s est écarté avant
 * tout appariement et n'est jamais persisté.
 */
const MIN_LAP_DISTANCE_M = 50
const MIN_LAP_DURATION_SEC = 15

/** Écarte les laps parasites (trop courts en distance ou en durée). */
export function filterLaps(laps: Lap[]): Lap[] {
  return laps.filter((l) => {
    if (l.distance_m == null || l.distance_m < MIN_LAP_DISTANCE_M) return false
    if (l.duration_sec == null || l.duration_sec < MIN_LAP_DURATION_SEC) return false
    return true
  })
}

function expectedMetric(step: Step): { expected: number | null; kind: "distance" | "duration" } {
  if (step.distance_m != null) return { expected: step.distance_m, kind: "distance" }
  return { expected: step.duration_sec, kind: "duration" }
}

function relError(expected: number | null, actual: number | null): number {
  if (actual == null) return Infinity
  if (!expected || expected <= 0) return Math.abs(actual - (expected ?? 0))
  return Math.abs(actual - expected) / expected
}

/** Types de step pouvant absorber plusieurs laps consécutifs (voir alignStepsToLaps). */
const AGGREGATABLE_TYPES = new Set(["warmup", "cooldown", "run"])

interface Assignment {
  start: number // index du premier lap du groupe, -1 si aucun
  count: number // nombre de laps consommés (1 hors agrégation, 0 si aucun)
}

/** Métrique primaire d'un lap selon le type d'attente du step. */
function lapMetric(lap: Lap, kind: "distance" | "duration"): number | null {
  return kind === "distance" ? lap.distance_m : lap.duration_sec
}

/**
 * Aligne chaque step sur un ou plusieurs laps consécutifs. Retourne, pour chaque
 * step, l'index du premier lap et le nombre de laps consommés (0 si aucun).
 *
 * - Nombre égal → alignement 1:1 par index (workout programmé sur la montre).
 * - Nombre différent → glouton monotone : on parcourt les steps dans l'ordre et,
 *   pour chacun, on choisit comme lap de départ, parmi les laps encore disponibles
 *   (fenêtre bornée par le surplus de laps restants), celui dont la métrique
 *   primaire (distance si le step est en distance, sinon durée) colle le mieux.
 * - Agrégation : uniquement pour warmup/cooldown/run (jamais interval/recovery,
 *   déjà découpés lap par lap par la montre), on étend le groupe aux laps suivants
 *   tant que l'erreur relative sur la métrique primaire s'améliore strictement,
 *   sans jamais laisser moins de laps que de steps restants.
 */
function alignStepsToLaps(steps: Step[], laps: Lap[]): Assignment[] {
  const S = steps.length
  const L = laps.length
  const result: Assignment[] = steps.map(() => ({ start: -1, count: 0 }))

  if (S === L) {
    for (let i = 0; i < S; i++) result[i] = { start: i, count: 1 }
    return result
  }

  let p = 0
  for (let si = 0; si < S; si++) {
    const remainingSteps = S - si
    const remainingLaps = L - p
    if (remainingLaps <= 0) break // plus de laps : steps restants sans réalisé

    const maxSkip = Math.max(0, remainingLaps - remainingSteps)
    const { expected, kind } = expectedMetric(steps[si])

    // 1. Lap de départ : meilleur lap unique dans la fenêtre de saut autorisée.
    let bestJ = p
    let bestCost = Infinity
    for (let j = p; j <= p + maxSkip && j < L; j++) {
      const cost = relError(expected, lapMetric(laps[j], kind))
      if (cost < bestCost) {
        bestCost = cost
        bestJ = j
      }
    }

    // 2. Agrégation des laps suivants, pour les seuls types agrégeables.
    let count = 1
    if (AGGREGATABLE_TYPES.has(steps[si].step_type)) {
      let aggMetric = lapMetric(laps[bestJ], kind) ?? 0
      let curErr = relError(expected, aggMetric)
      while (bestJ + count < L) {
        // Contrainte dure : ne jamais affamer les steps suivants.
        const remainingStepsAfter = S - (si + 1)
        const remainingLapsAfter = L - (bestJ + count + 1)
        if (remainingLapsAfter < remainingStepsAfter) break

        const next = lapMetric(laps[bestJ + count], kind)
        if (next == null) break
        const newErr = relError(expected, aggMetric + next)
        if (newErr >= curErr) break // s'arrête dès que l'erreur cesse de diminuer

        aggMetric += next
        curErr = newErr
        count++
      }
    }

    result[si] = { start: bestJ, count }
    p = bestJ + count
  }
  return result
}

function statusFor(delta: number, tolerance: number): Comparison["status"] {
  const abs = Math.abs(delta)
  if (abs <= tolerance) return "ok"
  if (abs <= tolerance + 4) return "proche"
  return "ecart"
}

export interface MatchResult {
  actualLaps: ActualLap[]
  comparisons: Comparison[]
}

/**
 * Agrège un groupe de laps consécutifs. Distance et durée sont sommées, l'allure
 * est recalculée sur les totaux (JAMAIS une moyenne d'allures) et la FC est une
 * moyenne pondérée par la durée. Un groupe d'un seul lap est renvoyé tel quel.
 */
function aggregateLaps(group: Lap[]): Lap {
  if (group.length === 1) return group[0]

  let dist = 0
  let hasDist = false
  let dur = 0
  let hasDur = false
  let hrWeighted = 0
  let hrDur = 0
  for (const l of group) {
    if (l.distance_m != null) {
      dist += l.distance_m
      hasDist = true
    }
    if (l.duration_sec != null) {
      dur += l.duration_sec
      hasDur = true
    }
    if (l.avg_hr != null && l.duration_sec != null) {
      hrWeighted += l.avg_hr * l.duration_sec
      hrDur += l.duration_sec
    }
  }

  const distance_m = hasDist ? dist : null
  const duration_sec = hasDur ? dur : null
  const avg_pace_sec = distance_m != null && distance_m > 0 && duration_sec != null && duration_sec > 0
    ? Math.round(duration_sec / (distance_m / 1000))
    : null
  const avg_hr = hrDur > 0 ? Math.round(hrWeighted / hrDur) : null
  return { distance_m, duration_sec, avg_pace_sec, avg_hr }
}

export function matchStepsToLaps(steps: Step[], rawLaps: Lap[]): MatchResult {
  // Filtrage des laps parasites AVANT tout appariement : les laps écartés ne sont
  // ni indexés ni persistés, ce qui garde lap_index cohérent entre actual_laps et
  // comparisons.
  const laps = filterLaps(rawLaps)

  const assignments = alignStepsToLaps(steps, laps)

  // lap_index → step_index. Pour un groupe agrégé, TOUS les laps du groupe portent
  // le step_index (pas seulement le premier).
  const lapToStep = new Array<number | null>(laps.length).fill(null)
  assignments.forEach(({ start, count }, stepIdx) => {
    if (start < 0) return
    for (let k = 0; k < count; k++) lapToStep[start + k] = stepIdx
  })

  const actualLaps: ActualLap[] = laps.map((lap, i) => ({
    lap_index: i,
    step_index: lapToStep[i],
    distance_m: lap.distance_m,
    duration_sec: lap.duration_sec,
    avg_pace_sec: lap.avg_pace_sec,
    avg_hr: lap.avg_hr,
  }))

  const comparisons: Comparison[] = []
  assignments.forEach(({ start, count }, stepIdx) => {
    if (start < 0) return // step sans lap : pas de comparaison
    const step = steps[stepIdx]
    const agg = aggregateLaps(laps.slice(start, start + count))
    const target = step.target_pace_sec

    // Récup / step sans allure cible → 'free'
    if (target == null) {
      comparisons.push({
        step_index: stepIdx,
        lap_index: start,
        lap_count: count,
        planned_pace: null,
        actual_pace: agg.avg_pace_sec,
        delta_sec: null,
        status: "free",
      })
      return
    }
    if (agg.avg_pace_sec == null) return // pas d'allure réelle mesurée

    const delta = agg.avg_pace_sec - target
    const tol = step.pace_tolerance_sec ?? 5
    comparisons.push({
      step_index: stepIdx,
      lap_index: start,
      lap_count: count,
      planned_pace: target,
      actual_pace: agg.avg_pace_sec,
      delta_sec: delta,
      status: statusFor(delta, tol),
    })
  })

  return { actualLaps, comparisons }
}
