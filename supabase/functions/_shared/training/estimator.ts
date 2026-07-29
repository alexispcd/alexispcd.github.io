// Estimation de durée et recomposition (trim) du contenu renfo.
//
// Ce module est la SOURCE UNIQUE de l'heuristique d'estimation et du trim,
// partagée telle quelle par le backend (strength.ts, qui le réexporte) et par
// le frontend (src/apps/training/session/renfo.js, qui l'importe). Il ne dépend
// PAS du catalogue exercises.ts : le bundle frontend peut l'importer sans y
// tirer les 46 exercices et leurs descriptions. Seul import autorisé : les
// types.

import type { StrengthBlock, StrengthExercise } from "./types.ts"

// ── Heuristique d'estimation (secondes) ───────────────────────────────────────
export const PER_REP_SEC = 3 // ~3 s par répétition

/** Repos entre deux exercices d'un même tour. Plancher métier : jamais sous 15 s. */
export const REST_BETWEEN_EXERCISES_SEC = 15
/** Repos entre deux tours, et entre deux blocs. */
export const REST_BETWEEN_ROUNDS_SEC = 20

/** Planchers du trim : en deçà, un circuit n'en est plus un. */
const MIN_EXERCISES_PER_BLOCK = 2
const MIN_ROUNDS = 2

/** Slug imposé par le code dans le bloc Force de chaque séance renfo. */
export const MANDATORY_CALF_SLUG = "excentrique_mollet"

// ── Résolution de l'unilatéralité (injectée) ──────────────────────────────────
// Le backend estime la sortie BRUTE du modèle, où le champ `unilateral` est
// absent : il doit le résoudre depuis le catalogue. Le frontend travaille sur
// des exercices déjà enrichis qui portent `unilateral`. On injecte donc la
// résolution plutôt que de la coder en dur ici (ce qui tirerait le catalogue).
export type UnilateralResolver = (ex: StrengthExercise) => boolean
const defaultUnilateral: UnilateralResolver = (ex) => ex.unilateral === true

/**
 * Temps de travail d'un exercice sur UN tour, en secondes.
 * Un exercice unilatéral se fait des deux côtés, dans les deux modes.
 */
export function workSeconds(
  ex: StrengthExercise,
  unilateral: UnilateralResolver = defaultUnilateral,
): number {
  const sides = unilateral(ex) ? 2 : 1
  return ex.duration_sec != null
    ? ex.duration_sec * sides
    : (ex.reps ?? 0) * PER_REP_SEC * sides
}

/**
 * Durée estimée d'un exercice HISTORIQUE (toutes séries + repos inter-séries).
 * Ne concerne que les plans générés avant le format circuit : le doublage
 * unilatéral n'y portait que sur le mode duration, on conserve ce calcul tel quel.
 */
export function estimateExerciseSeconds(
  ex: StrengthExercise,
  unilateral: UnilateralResolver = defaultUnilateral,
): number {
  const sets = ex.sets ?? 1
  const perSet = ex.duration_sec != null
    ? ex.duration_sec * (unilateral(ex) ? 2 : 1)
    : (ex.reps ?? 0) * PER_REP_SEC
  return sets * perSet + Math.max(0, sets - 1) * (ex.rest_sec ?? 0)
}

/** Durée d'un bloc, en secondes. */
export function blockSeconds(
  b: StrengthBlock,
  unilateral: UnilateralResolver = defaultUnilateral,
): number {
  const exos = b.exercises ?? []
  const gaps = Math.max(0, exos.length - 1) * REST_BETWEEN_EXERCISES_SEC

  // Bloc historique : séries et repos portés par chaque exercice.
  if (b.rounds == null) {
    return exos.reduce((t, ex) => t + estimateExerciseSeconds(ex, unilateral), 0) + gaps
  }

  const rounds = Math.max(1, b.rounds)
  const perRound = exos.reduce((t, ex) => t + workSeconds(ex, unilateral), 0) + gaps
  return rounds * perRound + (rounds - 1) * REST_BETWEEN_ROUNDS_SEC
}

/** Durée estimée de la séance renfo (blocs), en minutes. */
export function estimateStrengthDuration(
  blocks: StrengthBlock[] | undefined | null,
  unilateral: UnilateralResolver = defaultUnilateral,
): number {
  const list = blocks ?? []
  const total = list.reduce((t, b) => t + blockSeconds(b, unilateral), 0) +
    Math.max(0, list.length - 1) * REST_BETWEEN_ROUNDS_SEC
  return Math.round(total / 60)
}

// ── Recomposition (trim) ──────────────────────────────────────────────────────
export const cloneBlocks = (blocks: StrengthBlock[] | undefined | null): StrengthBlock[] =>
  (blocks ?? []).map((b) => ({ ...b, exercises: (b.exercises ?? []).map((e) => ({ ...e })) }))

/**
 * Dernier exercice retirable d'un bloc, en partant de la fin. Le mollet
 * excentrique est imposé par le code (voir withMandatoryCalf) : il est injecté
 * en fin de bloc Force, donc exactement là où le trim mord en premier. Sans
 * cette exception il disparaîtrait dès le palier 40 min, qui est le défaut.
 */
export function lastRemovableIndex(exercises: StrengthExercise[]): number {
  for (let i = exercises.length - 1; i >= 0; i--) {
    if (exercises[i].slug !== MANDATORY_CALF_SLUG) return i
  }
  return -1
}

/**
 * Réduit la base vers une durée cible, de façon déterministe et idempotente
 * (toujours recalculé depuis la base, jamais expansé) :
 *   1. cible <= 30 min → on retire d'abord le bloc bonus (le 4e) entièrement ;
 *   2. on retire le dernier exercice du bloc le plus fourni, plancher à 2 ;
 *   3. tous les blocs au plancher → on retire un tour au bloc qui en a le plus,
 *      plancher à 2 tours.
 */
export function trimToTarget(
  baseBlocks: StrengthBlock[],
  targetMin: number,
  unilateral: UnilateralResolver = defaultUnilateral,
): StrengthBlock[] {
  const blocks = cloneBlocks(baseBlocks)
  let list = blocks
  if (targetMin <= 30 && list.length > 3) list = list.slice(0, 3)

  let guard = 0
  while (estimateStrengthDuration(list, unilateral) > targetMin && guard++ < 200) {
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
      const exercises = list[bi].exercises.filter((_, i) => i !== ei)
      list[bi] = { ...list[bi], exercises }
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
    list[ri] = { ...list[ri], rounds: (list[ri].rounds as number) - 1 }
  }
  return list
}
