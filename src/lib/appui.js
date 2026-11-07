// Variantes du calque d'appui (lot P1), à comparer sur l'iPhone depuis l'Atelier.
// Chaque variante pose des variables CSS sur <html> par data-appui (src/styles/theme.js),
// lues par le calque de toute ButtonBase et par appuiLigne (src/ui/appui.js).
// La variante choisie remplacera ce test : ses valeurs iront dans les jetons.

/** Opacités en fraction, durées en millisecondes. Le délai ne vaut qu'à l'apparition. */
export const VARIANTES = {
  A: { objet: 0.14, ligne: 0.06, entree: 100, delai: 0, sortie: 200 },
  B: { objet: 0.08, ligne: 0.04, entree: 150, delai: 0, sortie: 300 },
  C: { objet: 0.08, ligne: 0.04, entree: 150, delai: 80, sortie: 300 },
  D: { objet: 0.08, ligne: 0.04, entree: 150, delai: 120, sortie: 300 },
}

export const VARIANTE_DEFAUT = 'A'
export const STOCKAGE_APPUI = 'cairn-appui'

/** Variante admise, ou la variante par défaut. */
export const lireVariante = (valeur) => (Object.hasOwn(VARIANTES, valeur) ? valeur : VARIANTE_DEFAUT)

/** Variables CSS d'une variante. */
export const variablesAppui = (nom) => {
  const v = VARIANTES[lireVariante(nom)]
  return {
    '--appui-objet': String(v.objet),
    '--appui-ligne': String(v.ligne),
    '--appui-entree': `${v.entree}ms`,
    '--appui-delai': `${v.delai}ms`,
    '--appui-sortie': `${v.sortie}ms`,
  }
}

const pourcent = (x) => `${Math.round(x * 100)} %`

/** « C : 8 % et 4 %, 80 ms de délai », « A : 14 % et 6 %, sans délai ». */
export const libelleVariante = (nom) => {
  const n = lireVariante(nom)
  const v = VARIANTES[n]
  const delai = v.delai ? `${v.delai} ms de délai` : 'sans délai'
  return `${n} : ${pourcent(v.objet)} et ${pourcent(v.ligne)}, ${delai}`
}

/** Variante gardée sur cet appareil ; stockage indisponible : la variante par défaut. */
export const lireVarianteStockee = () => {
  try {
    return lireVariante(localStorage.getItem(STOCKAGE_APPUI))
  } catch {
    return VARIANTE_DEFAUT
  }
}

/** Pose la variante sur <html> et la garde (stockage indisponible : pour cette ouverture). */
export const appliquerVariante = (nom) => {
  const n = lireVariante(nom)
  document.documentElement.dataset.appui = n
  try {
    localStorage.setItem(STOCKAGE_APPUI, n)
  } catch {
    // Rien à faire : la variante vaut jusqu'au prochain démarrage.
  }
  return n
}
