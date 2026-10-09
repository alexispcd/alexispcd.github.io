// Messages d'erreur des appels de génération Renfo, toujours en français.

const BY_CODE = {
  profile_missing: "Règle d'abord ton matériel et ta fréquence.",
  cycle_generating: 'Le cycle est déjà en cours de préparation.',
  cycle_in_progress: "Le cycle en cours n'est pas encore terminé.",
}

/** Message lisible pour une erreur de renfo-cycle ou renfo-session. */
export const generationErrorMessage = (err) => {
  const code = err?.body?.code
  if (code && BY_CODE[code]) return BY_CODE[code]
  if (err?.status === 422) return "La séance proposée n'était pas valide. Réessaie."
  if (err?.status === 403) return "Le module Renfo n'est pas attribué à ton compte."
  if (err?.status == null) return 'Connexion impossible. Vérifie le réseau et réessaie.'
  return 'La génération a échoué. Réessaie dans un instant.'
}
