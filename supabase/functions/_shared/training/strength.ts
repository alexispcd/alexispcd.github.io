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
const PER_REP_SEC = 3        // ~3 s par répétition
const TRANSITION_SEC = 15    // transition entre deux exercices d'un même bloc
const BLOCK_GAP_SEC = 30     // transition entre deux blocs

export const DEFAULT_TARGET_MIN = 40

/** Unilatéral : lu sur l'exercice s'il est enrichi, sinon depuis le catalogue. */
function isUnilateral(ex: StrengthExercise): boolean {
  if (typeof ex.unilateral === "boolean") return ex.unilateral
  return EXERCISE_INDEX[ex.slug]?.unilateral ?? false
}

/** Durée estimée d'un exercice (toutes séries + repos inter-séries), en secondes. */
export function estimateExerciseSeconds(ex: StrengthExercise): number {
  const sets = ex.sets ?? 1
  const perSet = ex.duration_sec != null
    ? ex.duration_sec * (isUnilateral(ex) ? 2 : 1) // duration unilatéral = deux côtés
    : (ex.reps ?? 0) * PER_REP_SEC
  const work = sets * perSet
  const rest = Math.max(0, sets - 1) * (ex.rest_sec ?? 0)
  return work + rest
}

/** Durée estimée de la séance renfo (blocs), en minutes. */
export function estimateStrengthDuration(blocks: StrengthBlock[] | undefined | null): number {
  const list = blocks ?? []
  let total = 0
  for (const b of list) {
    const exos = b.exercises ?? []
    for (const ex of exos) total += estimateExerciseSeconds(ex)
    total += Math.max(0, exos.length - 1) * TRANSITION_SEC
  }
  total += Math.max(0, list.length - 1) * BLOCK_GAP_SEC
  return Math.round(total / 60)
}

// ── Recomposition (trim) ──────────────────────────────────────────────────────
const cloneBlocks = (blocks: StrengthBlock[] | undefined | null): StrengthBlock[] =>
  (blocks ?? []).map((b) => ({ ...b, exercises: (b.exercises ?? []).map((e) => ({ ...e })) }))

/**
 * Réduit la base vers une durée cible, de façon déterministe et idempotente
 * (toujours recalculé depuis la base, jamais expansé) :
 *   • cible <= 30 min → on retire d'abord le bloc bonus (le 4e) entièrement ;
 *   • puis on retire le dernier exercice du bloc le plus fourni jusqu'à
 *     atteindre la cible, sans jamais retirer le premier exercice d'un bloc.
 */
export function trimToTarget(baseBlocks: StrengthBlock[], targetMin: number): StrengthBlock[] {
  let blocks = cloneBlocks(baseBlocks)
  if (targetMin <= 30 && blocks.length > 3) blocks = blocks.slice(0, 3)

  let guard = 0
  while (estimateStrengthDuration(blocks) > targetMin && guard++ < 200) {
    // Bloc avec le plus d'exercices (au moins 2 pour préserver le premier).
    let bi = -1
    let max = 1
    blocks.forEach((b, i) => {
      const n = b.exercises?.length ?? 0
      if (n > max) { max = n; bi = i }
    })
    if (bi < 0) break
    blocks[bi] = { ...blocks[bi], exercises: blocks[bi].exercises.slice(0, -1) }
  }
  return blocks
}

// ── Enrichissement ────────────────────────────────────────────────────────────
/**
 * Résout chaque exercice (slug → name / description / category / equipment /
 * unilateral) et pose un thème de bloc déterministe. Les slugs inconnus
 * (rétrocompatibilité) sont laissés tels quels.
 */
export function enrichBlocks(blocks: StrengthBlock[] | undefined | null): StrengthBlock[] {
  return (blocks ?? []).map((b, bi) => {
    const exercises: StrengthExercise[] = (b.exercises ?? []).map((ex) => {
      const cat = EXERCISE_INDEX[ex.slug]
      if (!cat) return { ...ex }
      return {
        slug: ex.slug,
        sets: ex.sets,
        reps: ex.reps ?? null,
        duration_sec: ex.duration_sec ?? null,
        rest_sec: ex.rest_sec,
        name: cat.name,
        description: cat.description,
        category: cat.category,
        equipment: cat.equipment,
        unilateral: cat.unilateral,
      }
    })

    let theme = b.theme ?? "Bonus"
    if (bi in BLOCK_THEMES) {
      theme = BLOCK_THEMES[bi]
    } else {
      const cats = exercises.map((e) => e.category).filter(Boolean) as ExerciseCategory[]
      const kind = detectBonusKind(cats)
      if (kind) theme = BONUS_THEME[kind]
    }
    return { theme, exercises }
  })
}

/**
 * Finalise le contenu renfo pour la persistance : enrichit la base complète,
 * la fige sous `base_blocks`, et pose `blocks` = base réduite à la durée par
 * défaut (40 min). Idempotent : recalcule toujours depuis la base.
 */
export function finalizeStrengthContent(
  content: Partial<StrengthContent> | null | undefined,
  target: number = DEFAULT_TARGET_MIN,
): StrengthContent {
  const rawBase = content?.base_blocks ?? content?.blocks ?? []
  const base = enrichBlocks(rawBase)
  return {
    target_duration_min: target,
    base_blocks: base,
    blocks: trimToTarget(base, target),
  }
}
