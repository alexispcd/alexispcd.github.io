// Estimation de durée, recomposition (trim) et enrichissement du contenu renfo.
//
// L'estimateur et le trim ci-dessous sont la RÉFÉRENCE : le frontend
// (src/apps/training/session/renfo.js) en tient un miroir strict (mêmes
// constantes, même heuristique), car il ne peut pas importer depuis
// supabase/functions.

import {
  BLOCK_THEMES, BONUS_THEME, detectBonusKind, EXERCISE_INDEX,
  type ExerciseCategory,
} from "./exercises.ts"
import type { StrengthBlock, StrengthContent, StrengthExercise } from "./types.ts"

// ── Heuristique d'estimation (secondes) ───────────────────────────────────────
const PER_REP_SEC = 3 // ~3 s par répétition

/** Repos entre deux exercices d'un même tour. */
export const REST_BETWEEN_EXERCISES_SEC = 20
/** Repos entre deux tours, et entre deux blocs. */
export const REST_BETWEEN_ROUNDS_SEC = 30

export const DEFAULT_TARGET_MIN = 40

/** Planchers du trim : en deçà, un circuit n'en est plus un. */
const MIN_EXERCISES_PER_BLOCK = 2
const MIN_ROUNDS = 2

/** Slug imposé par le code dans le bloc Force de chaque séance renfo. */
export const MANDATORY_CALF_SLUG = "excentrique_mollet"

/** Unilatéral : lu sur l'exercice s'il est enrichi, sinon depuis le catalogue. */
function isUnilateral(ex: StrengthExercise): boolean {
  if (typeof ex.unilateral === "boolean") return ex.unilateral
  return EXERCISE_INDEX[ex.slug]?.unilateral ?? false
}

/**
 * Temps de travail d'un exercice sur UN tour, en secondes.
 * Un exercice unilatéral se fait des deux côtés, dans les deux modes.
 */
export function workSeconds(ex: StrengthExercise): number {
  const sides = isUnilateral(ex) ? 2 : 1
  return ex.duration_sec != null
    ? ex.duration_sec * sides
    : (ex.reps ?? 0) * PER_REP_SEC * sides
}

/**
 * Durée estimée d'un exercice HISTORIQUE (toutes séries + repos inter-séries).
 * Ne concerne que les plans générés avant le format circuit : le doublage
 * unilatéral n'y portait que sur le mode duration, on conserve ce calcul tel quel.
 */
export function estimateExerciseSeconds(ex: StrengthExercise): number {
  const sets = ex.sets ?? 1
  const perSet = ex.duration_sec != null
    ? ex.duration_sec * (isUnilateral(ex) ? 2 : 1)
    : (ex.reps ?? 0) * PER_REP_SEC
  return sets * perSet + Math.max(0, sets - 1) * (ex.rest_sec ?? 0)
}

/** Durée d'un bloc, en secondes. */
function blockSeconds(b: StrengthBlock): number {
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
export function estimateStrengthDuration(blocks: StrengthBlock[] | undefined | null): number {
  const list = blocks ?? []
  const total = list.reduce((t, b) => t + blockSeconds(b), 0) +
    Math.max(0, list.length - 1) * REST_BETWEEN_ROUNDS_SEC
  return Math.round(total / 60)
}

// ── Recomposition (trim) ──────────────────────────────────────────────────────
const cloneBlocks = (blocks: StrengthBlock[] | undefined | null): StrengthBlock[] =>
  (blocks ?? []).map((b) => ({ ...b, exercises: (b.exercises ?? []).map((e) => ({ ...e })) }))

/**
 * Dernier exercice retirable d'un bloc, en partant de la fin. Le mollet
 * excentrique est imposé par le code (voir withMandatoryCalf) : il est injecté
 * en fin de bloc Force, donc exactement là où le trim mord en premier. Sans
 * cette exception il disparaîtrait dès le palier 40 min, qui est le défaut.
 */
function lastRemovableIndex(exercises: StrengthExercise[]): number {
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
export function trimToTarget(baseBlocks: StrengthBlock[], targetMin: number): StrengthBlock[] {
  const blocks = cloneBlocks(baseBlocks)
  let list = blocks
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

// ── Enrichissement ────────────────────────────────────────────────────────────
/**
 * Résout chaque exercice (slug → name / description / category / equipment /
 * unilateral) et pose un thème de bloc déterministe. Les slugs inconnus
 * (rétrocompatibilité) sont laissés tels quels.
 */
export function enrichBlocks(blocks: StrengthBlock[] | undefined | null): StrengthBlock[] {
  return (blocks ?? []).map((b, bi) => {
    const isCircuit = b.rounds != null
    const exercises: StrengthExercise[] = (b.exercises ?? []).map((ex) => {
      const cat = EXERCISE_INDEX[ex.slug]
      if (!cat) return { ...ex }
      const resolved: StrengthExercise = {
        slug: ex.slug,
        reps: ex.reps ?? null,
        duration_sec: ex.duration_sec ?? null,
        name: cat.name,
        description: cat.description,
        category: cat.category,
        equipment: cat.equipment,
        unilateral: cat.unilateral,
      }
      // Bloc historique : on conserve séries et repos portés par l'exercice.
      return isCircuit ? resolved : { ...resolved, sets: ex.sets, rest_sec: ex.rest_sec }
    })

    let theme = b.theme ?? "Bonus"
    if (bi in BLOCK_THEMES) {
      theme = BLOCK_THEMES[bi]
    } else {
      const cats = exercises.map((e) => e.category).filter(Boolean) as ExerciseCategory[]
      const kind = detectBonusKind(cats)
      if (kind) theme = BONUS_THEME[kind]
    }
    return isCircuit ? { theme, rounds: b.rounds, exercises } : { theme, exercises }
  })
}

// ── Mollet excentrique obligatoire ────────────────────────────────────────────
/** Dosage volontairement bas : travail excentrique lent, et coût maîtrisé. */
const MANDATORY_CALF_REPS = 10
const FORCE_BLOCK_INDEX = 1

/**
 * Garantit la présence du mollet excentrique dans le bloc Force.
 *
 * Injecté par le CODE et non par le modèle (RENFO_RULES le lui interdit
 * explicitement) : c'est une prévention systématique, elle ne doit pas dépendre
 * du bon vouloir du modèle. Appelé APRÈS la validation de la sortie modèle,
 * donc la catégorie pied_mollets dans le bloc Force ne heurte jamais le contrôle
 * de catégories de validate.ts.
 */
export function withMandatoryCalf(blocks: StrengthBlock[]): StrengthBlock[] {
  const present = blocks.some((b) => (b.exercises ?? []).some((e) => e.slug === MANDATORY_CALF_SLUG))
  const force = blocks[FORCE_BLOCK_INDEX]
  if (present || !force) return blocks

  const out = blocks.slice()
  out[FORCE_BLOCK_INDEX] = {
    ...force,
    exercises: [...(force.exercises ?? []), { slug: MANDATORY_CALF_SLUG, reps: MANDATORY_CALF_REPS }],
  }
  return out
}

/**
 * Finalise le contenu renfo pour la persistance : injecte le mollet excentrique,
 * enrichit la base complète, la fige sous `base_blocks`, et pose `blocks` = base
 * réduite à la durée par défaut (40 min). Idempotent : recalcule toujours depuis
 * la base, et l'injection est sans effet si le slug est déjà présent.
 */
export function finalizeStrengthContent(
  content: Partial<StrengthContent> | null | undefined,
  target: number = DEFAULT_TARGET_MIN,
): StrengthContent {
  const rawBase = content?.base_blocks ?? content?.blocks ?? []
  const base = enrichBlocks(withMandatoryCalf(rawBase))
  return {
    target_duration_min: target,
    base_blocks: base,
    blocks: trimToTarget(base, target),
  }
}
