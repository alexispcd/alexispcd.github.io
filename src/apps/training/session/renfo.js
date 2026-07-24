// Recomposition locale déterministe du contenu renfo selon la durée choisie.
//
// MIROIR de supabase/functions/_shared/training/strength.ts : mêmes constantes,
// même heuristique d'estimation et même logique de trim. Le frontend ne peut pas
// importer depuis supabase/functions, d'où cette copie. Toute évolution de
// l'heuristique doit être répercutée des deux côtés.
//
// La base (base_blocks, ~45 min) sert de référence. Les 3 durées proposées en
// sont dérivées par retrait piloté par l'estimateur, jamais par expansion :
//   • 45 min → base complète (référence).
//   • 40 min → base réduite jusqu'à 40 min (retrait des derniers exercices).
//   • 30 min → bloc bonus retiré, puis réduction jusqu'à 30 min.
// Toujours recalculé depuis la base → idempotent.

// Palier par défaut à la persistance = 40 min (voir finalizeStrengthContent).
export const RENFO_DURATIONS = [30, 40, 45]

// ── Heuristique d'estimation (identique au backend) ──────────────────────────
export const PER_REP_SEC = 3
/** Repos entre deux exercices d'un même tour. */
export const REST_BETWEEN_EXERCISES_SEC = 15
/** Repos entre deux tours, et entre deux blocs. */
export const REST_BETWEEN_ROUNDS_SEC = 20

/** Planchers du trim : en deçà, un circuit n'en est plus un. */
const MIN_EXERCISES_PER_BLOCK = 2
const MIN_ROUNDS = 2

/** Slug imposé par le backend dans le bloc Force (voir strength.ts). */
export const MANDATORY_CALF_SLUG = 'excentrique_mollet'

/**
 * Temps de travail d'un exercice sur UN tour, en secondes.
 * Un exercice unilatéral se fait des deux côtés, dans les deux modes.
 */
export const workSeconds = (ex) => {
  const sides = ex.unilateral ? 2 : 1
  return ex.duration_sec != null
    ? ex.duration_sec * sides
    : (ex.reps ?? 0) * PER_REP_SEC * sides
}

/**
 * Durée d'un exercice HISTORIQUE (séries + repos inter-séries). Ne concerne que
 * les plans générés avant le format circuit : le doublage unilatéral n'y portait
 * que sur le mode duration, on conserve ce calcul tel quel.
 */
export const estimateExerciseSeconds = (ex) => {
  const sets = ex.sets ?? 1
  const perSet = ex.duration_sec != null
    ? ex.duration_sec * (ex.unilateral ? 2 : 1)
    : (ex.reps ?? 0) * PER_REP_SEC
  return sets * perSet + Math.max(0, sets - 1) * (ex.rest_sec ?? 0)
}

/** Durée d'un bloc, en secondes. */
const blockSeconds = (b) => {
  const exos = b.exercises ?? []
  const gaps = Math.max(0, exos.length - 1) * REST_BETWEEN_EXERCISES_SEC

  // Bloc historique : séries et repos portés par chaque exercice.
  if (b.rounds == null) {
    return exos.reduce((t, ex) => t + estimateExerciseSeconds(ex), 0) + gaps
  }

  const rounds = Math.max(1, b.rounds)
  const perRound = exos.reduce((t, ex) => t + workSeconds(ex), 0) + gaps
  return rounds * perRound + (rounds - 1) * REST_BETWEEN_ROUNDS_SEC
}

/** Durée estimée de la séance renfo (blocs), en minutes. */
export const estimateStrengthDuration = (blocks) => {
  const list = blocks ?? []
  const total = list.reduce((t, b) => t + blockSeconds(b), 0)
    + Math.max(0, list.length - 1) * REST_BETWEEN_ROUNDS_SEC
  return Math.round(total / 60)
}

const cloneBlocks = (blocks) =>
  (blocks ?? []).map((b) => ({
    ...b,
    exercises: (b.exercises ?? []).map((e) => ({ ...e })),
  }))

/**
 * Dernier exercice retirable d'un bloc, en partant de la fin. Le mollet
 * excentrique est imposé par le backend en fin de bloc Force, donc exactement là
 * où le trim mord en premier : sans cette exception il disparaîtrait dès le
 * palier 40 min, qui est le défaut.
 */
const lastRemovableIndex = (exercises) => {
  for (let i = exercises.length - 1; i >= 0; i--) {
    if (exercises[i].slug !== MANDATORY_CALF_SLUG) return i
  }
  return -1
}

/**
 * Réduit la base vers une durée cible (miroir de trimToTarget backend) :
 *   1. cible <= 30 min → retrait du bloc bonus ;
 *   2. retrait du dernier exercice du bloc le plus fourni, plancher à 2 ;
 *   3. tous les blocs au plancher → retrait d'un tour au bloc qui en a le plus,
 *      plancher à 2 tours.
 */
export const trimToTarget = (baseBlocks, targetMin) => {
  let list = cloneBlocks(baseBlocks)
  if (targetMin <= 30 && list.length > 3) list = list.slice(0, 3)

  let guard = 0
  while (estimateStrengthDuration(list) > targetMin && guard++ < 200) {
    // 2. Bloc le plus fourni au-dessus du plancher, ayant encore un exercice
    //    retirable (le mollet excentrique est imposé, on ne le retire jamais).
    let bi = -1
    let ei = -1
    let maxExos = MIN_EXERCISES_PER_BLOCK
    list.forEach((b, i) => {
      const exos = b.exercises ?? []
      if (exos.length <= maxExos) return
      const last = lastRemovableIndex(exos)
      if (last >= 0) { maxExos = exos.length; bi = i; ei = last }
    })
    if (bi >= 0) {
      list[bi] = { ...list[bi], exercises: list[bi].exercises.filter((_, i) => i !== ei) }
      continue
    }

    // 3. Plus rien à retirer : on réduit le nombre de tours.
    let ri = -1
    let maxRounds = MIN_ROUNDS
    list.forEach((b, i) => {
      const r = b.rounds ?? 0
      if (r > maxRounds) { maxRounds = r; ri = i }
    })
    if (ri < 0) break
    list[ri] = { ...list[ri], rounds: list[ri].rounds - 1 }
  }
  return list
}

/**
 * Applique une durée au strength_content.
 * Fige la base à la première recomposition (base_blocks) pour rester idempotent.
 * Retourne un nouvel objet strength_content prêt à persister.
 */
export const applyDuration = (content, duration) => {
  const base = content.base_blocks ?? content.blocks ?? []
  return {
    ...content,
    base_blocks: cloneBlocks(base),
    blocks: trimToTarget(base, duration),
    target_duration_min: duration,
  }
}
