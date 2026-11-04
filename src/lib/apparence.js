// Réglages d'apparence de la page Compte : thème, pression et retour en place.
// Pur, sans DOM ni React : lu par useApparence et par les tests Node.

/** Valeurs admises et valeur par défaut de chaque réglage. */
export const REGLAGES = {
  theme: { valeurs: ['auto', 'light', 'dark'], defaut: 'auto', stockage: 'cairn-theme', cle: 'dark_mode' },
  pression: { valeurs: ['fond', 'agrandit'], defaut: 'fond', stockage: 'cairn-pression', cle: 'press_style' },
  retour: { valeurs: ['sobre', 'ressort'], defaut: 'sobre', stockage: 'cairn-retour', cle: 'release_style' },
}

/** Clés de user_preferences lues à la connexion. */
export const CLES_PREFERENCES = Object.values(REGLAGES).map((r) => r.cle)

/** Valeur admise du réglage `nom`, ou son défaut si `valeur` est inconnue ou absente. */
export const lireReglage = (nom, valeur) => {
  const r = REGLAGES[nom]
  return r.valeurs.includes(valeur) ? valeur : r.defaut
}

/** Valeur admise du réglage, ou null si `valeur` est inconnue (la base ne l'emporte pas). */
export const reglageValide = (nom, valeur) => (REGLAGES[nom].valeurs.includes(valeur) ? valeur : null)

/** Vrai si l'app s'affiche en sombre : 'auto' suit le système. */
export const resoudreSombre = (theme, systemeSombre) => {
  const t = lireReglage('theme', theme)
  return t === 'auto' ? Boolean(systemeSombre) : t === 'dark'
}

/**
 * Lignes de user_preferences ([{ key, value }]) vers les réglages qu'elles portent :
 * { theme?, pression?, retour? }. Une valeur inconnue est ignorée.
 */
export const reglagesDepuisPreferences = (lignes = []) => {
  const sortie = {}
  for (const [nom, r] of Object.entries(REGLAGES)) {
    const ligne = lignes.find((l) => l?.key === r.cle)
    const valeur = ligne ? reglageValide(nom, ligne.value) : null
    if (valeur) sortie[nom] = valeur
  }
  return sortie
}
