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
const PER_REP_SEC = 3
const TRANSITION_SEC = 15
const BLOCK_GAP_SEC = 30

/** Durée estimée d'un exercice en secondes (toutes séries + repos inter-séries). */
export const estimateExerciseSeconds = (ex) => {
  const sets = ex.sets ?? 1
  const perSet = ex.duration_sec != null
    ? ex.duration_sec * (ex.unilateral ? 2 : 1) // duration unilatéral = deux côtés
    : (ex.reps ?? 0) * PER_REP_SEC
  const work = sets * perSet
  const rest = Math.max(0, sets - 1) * (ex.rest_sec ?? 0)
  return work + rest
}

/** Durée estimée de la séance renfo (blocs), en minutes. */
export const estimateStrengthDuration = (blocks) => {
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

const cloneBlocks = (blocks) =>
  (blocks ?? []).map((b) => ({
    ...b,
    exercises: (b.exercises ?? []).map((e) => ({ ...e })),
  }))

/** Réduit la base vers une durée cible (miroir de trimToTarget backend). */
export const trimToTarget = (baseBlocks, targetMin) => {
  let blocks = cloneBlocks(baseBlocks)
  if (targetMin <= 30 && blocks.length > 3) blocks = blocks.slice(0, 3)

  let guard = 0
  while (estimateStrengthDuration(blocks) > targetMin && guard++ < 200) {
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
