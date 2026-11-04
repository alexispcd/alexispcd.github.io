// Élastiques joués d'une séance Renfo, gardés en sessionStorage entre la fin du
// player et la validation : ils ne sont écrits en base qu'avec la séance faite
// (completeSession de src/lib/renfo.js). Sans eux, un retour depuis la page
// « Valider la séance » les perdrait. Chaque accès est protégé : stockage absent,
// plein ou bloqué, on fait sans.

const cle = (sessionId) => `cairn-renfo-bandes-${sessionId}`

/** Élastiques gardés pour la séance ({ "<slug>": kg }), ou null. */
export const lireBandesJouees = (sessionId) => {
  try {
    const brut = sessionStorage.getItem(cle(sessionId))
    if (!brut) return null
    const valeur = JSON.parse(brut)
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur) ? valeur : null
  } catch {
    return null
  }
}

/** Garde les élastiques joués de la séance jusqu'à sa validation. */
export const garderBandesJouees = (sessionId, bandes) => {
  try {
    if (bandes && Object.keys(bandes).length) sessionStorage.setItem(cle(sessionId), JSON.stringify(bandes))
    else sessionStorage.removeItem(cle(sessionId))
  } catch {
    // Stockage indisponible : les élastiques seront ceux de la séance.
  }
}

/** Efface les élastiques gardés, après la validation. */
export const effacerBandesJouees = (sessionId) => {
  try {
    sessionStorage.removeItem(cle(sessionId))
  } catch {
    // Rien à effacer.
  }
}
