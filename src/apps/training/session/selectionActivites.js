// Sélection des activités Coros sur la page « Valider la séance » (pur, testé).
// État : { ids, sans } ; ids = labelId des activités cochées, sans = « Sans activité »
// coché. Une fonction de transition par geste, chacune renvoie un nouvel état.

/** Activités liées au plus par validation (garde-fou de complete-session). */
export const MAX_ACTIVITES = 3

export const selectionVide = () => ({ ids: [], sans: false })

/**
 * Après la recherche : la première activité cochée (la liste arrive triée par
 * proximité de date) ; aucune activité : « Sans activité ».
 */
export const apresRecherche = (candidats) => {
  const premier = candidats?.[0]?.labelId
  return premier ? { ids: [premier], sans: false } : { ids: [], sans: true }
}

/**
 * Toucher une activité : non cochée, elle se coche et retire « Sans activité »
 * (rien ne change à MAX_ACTIVITES) ; cochée, elle se décoche, et la dernière
 * décochée coche « Sans activité ».
 */
export const toucherActivite = (selection, id) => {
  if (selection.ids.includes(id)) {
    const ids = selection.ids.filter((x) => x !== id)
    return { ids, sans: ids.length === 0 }
  }
  if (selection.ids.length >= MAX_ACTIVITES) return selection
  return { ids: [...selection.ids, id], sans: false }
}

/**
 * Toucher « Sans activité » : non coché, il vide les activités ; coché, il recoche
 * la première activité s'il y en a une, sinon rien ne change.
 */
export const toucherSans = (selection, candidats) => {
  if (!selection.sans) return { ids: [], sans: true }
  const premier = candidats?.[0]?.labelId
  return premier ? { ids: [premier], sans: false } : selection
}

/**
 * Charge utile de complete-session pour les activités cochées, dans l'ordre de la
 * liste (le serveur les trie par début) : id, start_timestamp et sport_type (100
 * course, 102 trail, pour que queryActivityLapData vise le bon sport). null sans activité.
 */
export const activitesAEnvoyer = (selection, candidats) => {
  if (selection.sans || !selection.ids.length) return null
  const choisies = (candidats ?? []).filter((c) => selection.ids.includes(c.labelId))
  if (!choisies.length) return null
  return choisies.map((c) => ({
    id: c.labelId,
    start_timestamp: typeof c.startTimestamp === 'number' ? c.startTimestamp : null,
    sport_type: typeof c.sport_type === 'number' ? c.sport_type : null,
  }))
}
