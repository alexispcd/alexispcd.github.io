// Recomposition locale déterministe du contenu renfo selon la durée choisie.
//
// Le contenu généré par generate-plan sert de référence ("base", ~40 min).
// Les 3 durées proposées en sont dérivées par une règle simple et idempotente
// (toujours calculée depuis la base, jamais depuis l'état courant) :
//   • 30 min → on retire le dernier exercice des blocs de 3 exercices ou plus.
//   • 40 min → base inchangée (référence).
//   • 45 min → on ajoute une série à l'exercice principal (le 1er) de chaque bloc.
// Aucune recomposition IA à la volée : tout est local et prévisible.

// La base correspond au palier moyen (40 min) : 30 min la réduit, 45 min l'étend.
export const RENFO_DURATIONS = [30, 40, 45]

const cloneBlocks = (blocks) =>
  (blocks ?? []).map((b) => ({
    ...b,
    exercises: (b.exercises ?? []).map((e) => ({ ...e })),
  }))

const trim = (blocks) =>
  cloneBlocks(blocks).map((b) => ({
    ...b,
    exercises: b.exercises.length >= 3 ? b.exercises.slice(0, -1) : b.exercises,
  }))

const expand = (blocks) =>
  cloneBlocks(blocks).map((b) => ({
    ...b,
    exercises: b.exercises.map((e, i) =>
      i === 0 && typeof e.sets === 'number' ? { ...e, sets: e.sets + 1 } : e,
    ),
  }))

/** Blocs dérivés de la base pour une durée cible. */
export const recomposeBlocks = (baseBlocks, duration) => {
  if (duration <= 30) return trim(baseBlocks)
  if (duration >= 45) return expand(baseBlocks)
  return cloneBlocks(baseBlocks)
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
    blocks: recomposeBlocks(base, duration),
    target_duration_min: duration,
  }
}
