// Chemin de retour dans l'app après une connexion OAuth (coros-oauth). Module pur.
// Le chemin vient du client : il n'est accepté que s'il reste dans l'app, pour que
// le retour ne puisse jamais rediriger ailleurs (open redirect).

export const APP_ORIGIN = "https://alexispcd.github.io"
export const CHEMIN_RETOUR_DEFAUT = "/training/settings"
export const CHEMIN_RETOUR_MAX = 200

const SCHEMA = /^[a-z][a-z0-9+.-]*:/i

const aUnCaractereDeControle = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return true
  }
  return false
}

/**
 * Vrai pour un chemin interne : commence par un seul /, sans //, sans \, sans
 * schéma, sans caractère de contrôle, 200 caractères au plus.
 */
export const estCheminInterne = (valeur: unknown): valeur is string =>
  typeof valeur === "string" &&
  valeur.length > 0 &&
  valeur.length <= CHEMIN_RETOUR_MAX &&
  valeur.startsWith("/") &&
  !valeur.includes("//") &&
  !valeur.includes("\\") &&
  !SCHEMA.test(valeur) &&
  !aUnCaractereDeControle(valeur)

/** Chemin de retour retenu : la valeur si elle est interne, sinon le chemin par défaut. */
export const cheminRetour = (valeur: unknown): string =>
  estCheminInterne(valeur) ? valeur : CHEMIN_RETOUR_DEFAUT

/**
 * URL complète de retour vers l'app, avec coros=ok ou coros=error ajouté à la
 * query existante (séparateur ? ou &, fragment gardé à la fin).
 */
export const urlRetour = (chemin: unknown, resultat: "ok" | "error"): string => {
  const url = new URL(cheminRetour(chemin), APP_ORIGIN)
  // Ceinture : un chemin validé reste sur l'origine de l'app.
  if (url.origin !== APP_ORIGIN) return urlRetour(CHEMIN_RETOUR_DEFAUT, resultat)
  url.searchParams.set("coros", resultat)
  return url.toString()
}
