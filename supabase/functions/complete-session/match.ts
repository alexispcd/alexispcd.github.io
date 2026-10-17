// Matching steps ↔ laps et comparaison des allures. Tout est calculé en code,
// aucune décision déléguée à l'IA.
//
// Aucun lap n'est jamais écarté pour sa taille : une fraction très courte est
// une fraction réellement courue, un lap de pause reste rattaché à un step.
//
// Appariement (partitionLaps) :
// - Autant de laps que de steps, ou moins : 1:1 par index, les steps restants
//   n'ont pas de lap.
// - Plus de laps que de steps : programmation dynamique qui découpe les laps en
//   blocs consécutifs, un bloc par step dans l'ordre. Chaque step reçoit au moins
//   un lap et tous les laps sont attribués.
//   - warmup, cooldown et run peuvent recevoir plusieurs laps ;
//   - le dernier step peut toujours en recevoir plusieurs, quel que soit son
//     type : les laps superflus de fin lui reviennent ;
//   - tout autre step reçoit un seul lap, sauf si chaque frontière interne de son
//     bloc est une jonction entre deux activités (montre relancée en pleine
//     fraction) ;
//   - coût d'un bloc : erreur relative |somme - attendu| / attendu sur la
//     métrique primaire du step (distance si renseignée, sinon durée), un lap sans
//     valeur comptant 0. Step sans métrique attendue : coût 0 ;
//   - à coût égal, le step le plus tardif prend le bloc le plus long : les laps en
//     trop partent vers la fin.

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

/** Types de step pouvant absorber plusieurs laps consécutifs. */
const AGGREGATABLE_TYPES = new Set(["warmup", "cooldown", "run"])

/** Tolérance de comparaison des coûts (départage à coût égal). */
const COST_EPSILON = 1e-9

interface Assignment {
  start: number // index du premier lap du groupe, -1 si aucun
  count: number // nombre de laps consommés (0 si aucun)
}

/** Métrique primaire attendue d'un step : distance si renseignée, sinon durée. */
function expectedMetric(step: Step): { expected: number | null; kind: "distance" | "duration" } {
  if (step.distance_m != null) return { expected: step.distance_m, kind: "distance" }
  return { expected: step.duration_sec, kind: "duration" }
}

/**
 * Découpe les laps en un bloc consécutif par step (voir l'en-tête du fichier).
 * Retourne, pour chaque step, l'index du premier lap et le nombre de laps.
 * junctions : index des laps qui ouvrent une nouvelle activité (0 exclu).
 */
function partitionLaps(steps: Step[], laps: Lap[], junctions: Set<number>): Assignment[] {
  const S = steps.length
  const L = laps.length
  const result: Assignment[] = steps.map(() => ({ start: -1, count: 0 }))

  if (L <= S) {
    for (let i = 0; i < L; i++) result[i] = { start: i, count: 1 }
    return result
  }

  // Sommes préfixes des deux métriques (valeur null comptée 0).
  const prefDist = [0]
  const prefDur = [0]
  for (const lap of laps) {
    prefDist.push(prefDist[prefDist.length - 1] + (lap.distance_m ?? 0))
    prefDur.push(prefDur[prefDur.length - 1] + (lap.duration_sec ?? 0))
  }

  // junctionRun[i] : nombre de frontières consécutives qui sont des jonctions,
  // de i vers le bas. Un bloc [k, l) est autorisé si ses l - k - 1 frontières
  // internes (k + 1 à l - 1) sont toutes des jonctions.
  const junctionRun = new Array<number>(L + 1).fill(0)
  for (let i = 1; i <= L; i++) junctionRun[i] = junctions.has(i) ? junctionRun[i - 1] + 1 : 0

  const blockCost = (step: Step, k: number, l: number): number => {
    const { expected, kind } = expectedMetric(step)
    if (expected == null || expected <= 0) return 0
    const pref = kind === "distance" ? prefDist : prefDur
    return Math.abs(pref[l] - pref[k] - expected) / expected
  }

  // f[s][l] : coût minimal pour placer les s premiers steps sur les l premiers laps.
  // from[s][l] : début du bloc du step s dans cette solution.
  const f: number[][] = Array.from({ length: S + 1 }, () => new Array<number>(L + 1).fill(Infinity))
  const from: number[][] = Array.from({ length: S + 1 }, () => new Array<number>(L + 1).fill(-1))
  f[0][0] = 0

  for (let s = 1; s <= S; s++) {
    const step = steps[s - 1]
    const multi = s === S || AGGREGATABLE_TYPES.has(step.step_type)
    for (let l = s; l <= L - (S - s); l++) {
      let best = Infinity
      let bestK = -1
      for (let k = l - 1; k >= s - 1; k--) {
        const len = l - k
        if (len > 1 && !multi && junctionRun[l - 1] < len - 1) break
        if (!Number.isFinite(f[s - 1][k])) continue
        const total = f[s - 1][k] + blockCost(step, k, l)
        if (total <= best + COST_EPSILON) {
          best = total
          bestK = k
        }
      }
      f[s][l] = best
      from[s][l] = bestK
    }
  }

  let l = L
  for (let s = S; s >= 1; s--) {
    const k = from[s][l]
    result[s - 1] = { start: k, count: l - k }
    l = k
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
 * Agrège un groupe de laps consécutifs. Distance et durée sont sommées sur tous
 * les laps et la FC est une moyenne pondérée par la durée. L'allure est
 * recalculée sur les totaux (JAMAIS une moyenne d'allures) des seuls laps ayant
 * une allure valide : un lap de pause reste rattaché au step sans fausser son
 * allure. Aucun lap avec allure valide : allure null. Un groupe d'un seul lap est
 * renvoyé tel quel.
 */
function aggregateLaps(group: Lap[]): Lap {
  if (group.length === 1) return group[0]

  let dist = 0
  let hasDist = false
  let dur = 0
  let hasDur = false
  let hrWeighted = 0
  let hrDur = 0
  let paceDist = 0
  let paceDur = 0
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
    if (l.avg_pace_sec != null && l.distance_m != null && l.duration_sec != null) {
      paceDist += l.distance_m
      paceDur += l.duration_sec
    }
  }

  const distance_m = hasDist ? dist : null
  const duration_sec = hasDur ? dur : null
  const avg_pace_sec = paceDist > 0 && paceDur > 0 ? Math.round(paceDur / (paceDist / 1000)) : null
  const avg_hr = hrDur > 0 ? Math.round(hrWeighted / hrDur) : null
  return { distance_m, duration_sec, avg_pace_sec, avg_hr }
}

/**
 * Apparie les steps aux laps et compare les allures. activityStarts liste les
 * index (dans la liste concaténée) du premier lap de chaque activité, 0 compris.
 */
export function matchStepsToLaps(steps: Step[], laps: Lap[], activityStarts: number[] = [0]): MatchResult {
  const junctions = new Set(activityStarts.filter((i) => i > 0))
  const assignments = partitionLaps(steps, laps, junctions)

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
