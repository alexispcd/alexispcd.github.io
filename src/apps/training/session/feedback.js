// Helpers du ressenti post-séance (RPE), partagés entre RpeForm et les flux de
// complétion. Séparés du composant pour ne pas casser le fast refresh.

/** État initial d'un ressenti vierge. */
export const emptyFeedback = () => ({ rpe: null, painAreas: [], note: '' })

/**
 * Convertit la valeur du formulaire en payload BDD, ou null si totalement vierge.
 * Chaque champ est indépendant (RPE seul, douleurs seules, etc.).
 */
export const toFeedbackPayload = (value) => {
  const rpe = value.rpe ?? null
  const pain_areas = value.painAreas.length ? value.painAreas : null
  const feedback_note = value.note.trim() ? value.note.trim() : null
  if (rpe == null && pain_areas == null && feedback_note == null) return null
  return { rpe, pain_areas, feedback_note }
}
