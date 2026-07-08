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
  lap_index: number
  planned_pace: number | null
  actual_pace: number | null
  delta_sec: number | null
  status: "ok" | "proche" | "ecart" | "free"
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

/**
 * Aligne chaque step sur un lap. Retourne, pour chaque step, l'index du lap
 * assigné (ou -1 si aucun).
 *
 * - Nombre égal → alignement 1:1 par index (workout programmé sur la montre).
 * - Nombre différent → glouton monotone : on parcourt les steps dans l'ordre et,
 *   pour chacun, on choisit parmi les laps encore disponibles (dans une fenêtre
 *   bornée par le surplus de laps restants) celui dont la métrique primaire
 *   (distance si le step est en distance, sinon durée) colle le mieux. Les laps
 *   sautés deviennent unmatched ; s'il manque des laps, les derniers steps
 *   restent sans réalisé.
 */
function alignStepsToLaps(steps: Step[], laps: Lap[]): number[] {
  const S = steps.length
  const L = laps.length
  const stepToLap = new Array<number>(S).fill(-1)

  if (S === L) {
    for (let i = 0; i < S; i++) stepToLap[i] = i
    return stepToLap
  }

  let p = 0
  for (let si = 0; si < S; si++) {
    const remainingSteps = S - si
    const remainingLaps = L - p
    if (remainingLaps <= 0) break // plus de laps : steps restants sans réalisé

    const maxSkip = Math.max(0, remainingLaps - remainingSteps)
    const { expected, kind } = expectedMetric(steps[si])

    let bestJ = p
    let bestCost = Infinity
    for (let j = p; j <= p + maxSkip && j < L; j++) {
      const actual = kind === "distance" ? laps[j].distance_m : laps[j].duration_sec
      const cost = relError(expected, actual)
      if (cost < bestCost) {
        bestCost = cost
        bestJ = j
      }
    }
    stepToLap[si] = bestJ
    p = bestJ + 1
  }
  return stepToLap
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

export function matchStepsToLaps(steps: Step[], laps: Lap[]): MatchResult {
  const stepToLap = alignStepsToLaps(steps, laps)

  const lapToStep = new Array<number | null>(laps.length).fill(null)
  stepToLap.forEach((lapIdx, stepIdx) => {
    if (lapIdx >= 0) lapToStep[lapIdx] = stepIdx
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
  stepToLap.forEach((lapIdx, stepIdx) => {
    if (lapIdx < 0) return // step sans lap : pas de comparaison
    const step = steps[stepIdx]
    const lap = laps[lapIdx]
    const target = step.target_pace_sec

    // Récup / step sans allure cible → 'free'
    if (target == null) {
      comparisons.push({
        step_index: stepIdx,
        lap_index: lapIdx,
        planned_pace: null,
        actual_pace: lap.avg_pace_sec,
        delta_sec: null,
        status: "free",
      })
      return
    }
    if (lap.avg_pace_sec == null) return // pas d'allure réelle mesurée

    const delta = lap.avg_pace_sec - target
    const tol = step.pace_tolerance_sec ?? 5
    comparisons.push({
      step_index: stepIdx,
      lap_index: lapIdx,
      planned_pace: target,
      actual_pace: lap.avg_pace_sec,
      delta_sec: delta,
      status: statusFor(delta, tol),
    })
  })

  return { actualLaps, comparisons }
}
