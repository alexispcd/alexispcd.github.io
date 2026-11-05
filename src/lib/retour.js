// Retour en chaîne : une page ouverte avec state.retour revient là, et son chevron
// rend à cette page son propre état (state.retourEtat), pour qu'elle garde à son tour
// son retour. Exemple : dashboard, Historique des séances, séance, Valider.

/**
 * État à passer en ouvrant une sous-page d'une séance (Valider, Modifier, Remplacer) :
 * son chevron revient à la séance (backTo) avec l'état qu'avait la séance.
 */
export const etatSousPage = (location) => ({ retourEtat: location.state ?? null })

/** État de la séance, gardé par une sous-page, pour y revenir avec replace. */
export const etatSeance = (location) => location.state?.retourEtat ?? null
