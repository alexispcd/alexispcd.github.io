// Messages d'erreur des appels à renfo-session, toujours en français.
import { PAS_DE_CONNEXION, estErreurReseau } from '../../lib/reseau'

const BY_CODE = {
  profile_missing: "Règle d'abord ton matériel et ton objectif.",
  composition_invalide: "Cette composition n'est pas possible avec ton matériel. Change un thème ou le nombre d'exercices.",
  session_non_modifiable: 'Cette séance ne peut plus être modifiée.',
  reglage_invalide: "Ce réglage n'est pas possible pour cet exercice.",
  remplacement_invalide: "Cet exercice ne peut pas remplacer celui-ci dans ta séance.",
}

/** Message lisible pour une erreur de renfo-session (ancien chemin et actions). */
export const generationErrorMessage = (err) => {
  if (estErreurReseau(err)) return PAS_DE_CONNEXION
  const code = err?.body?.code
  if (code && BY_CODE[code]) return BY_CODE[code]
  if (err?.status === 422) return "La séance proposée n'était pas valide. Réessaie."
  if (err?.status === 404) return 'Séance introuvable.'
  if (err?.status === 403) return "Le module Renfo n'est pas attribué à ton compte."
  return 'Réessaie dans un instant.'
}
