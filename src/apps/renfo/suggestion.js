// Suggestion de séance Renfo, partagée par l'accueil Renfo et le bloc « Aujourd'hui »
// de l'Accueil : composition normale préremplie d'après le matériel et les séances faites.
import { availableExercises } from '../../../supabase/functions/_shared/strength/catalog.ts'
import { preremplir } from '../../../supabase/functions/_shared/strength/compose.ts'

/** Composition suggérée, ou null sans profil. */
export const suggestionDe = ({ profile, bands, done }) => {
  if (!profile) return null
  const available = availableExercises(profile.equipment ?? [], (bands ?? []).map((b) => b.kg))
  return preremplir({ intensity: 'normale', sessions: done ?? [], available })
}
