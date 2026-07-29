// Adaptateur frontend au-dessus de la source unique d'estimation et de trim
// (supabase/functions/_shared/training/estimator.ts). Ce module ne duplique plus
// l'heuristique : il l'importe et n'ajoute que ce qui est propre au frontend, la
// liste des paliers et l'application d'une durée. Les ré-exports (PER_REP_SEC,
// repos) servent au player (sequence.js) et à ses tests.
//
// La base (base_blocks, ~45 min) sert de référence. Les 3 durées proposées en
// sont dérivées par retrait piloté par l'estimateur, jamais par expansion :
//   • 45 min → base complète (référence).
//   • 40 min → base réduite jusqu'à 40 min (retrait des derniers exercices).
//   • 30 min → bloc bonus retiré, puis réduction jusqu'à 30 min.
// Toujours recalculé depuis la base → idempotent.

import {
  cloneBlocks,
  trimToTarget,
} from '../../../../supabase/functions/_shared/training/estimator.ts'

export {
  PER_REP_SEC,
  REST_BETWEEN_EXERCISES_SEC,
  REST_BETWEEN_ROUNDS_SEC,
  estimateStrengthDuration,
} from '../../../../supabase/functions/_shared/training/estimator.ts'

// Palier par défaut à la persistance = 40 min (voir finalizeStrengthContent).
export const RENFO_DURATIONS = [30, 40, 45]

/**
 * Applique une durée au strength_content.
 * Fige la base à la première recomposition (base_blocks) pour rester idempotent.
 * Retourne un nouvel objet strength_content prêt à persister.
 *
 * trimToTarget est appelé sans résolveur d'unilatéralité : le frontend travaille
 * sur des exercices déjà enrichis qui portent le champ `unilateral`, que le
 * résolveur par défaut lit directement.
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
