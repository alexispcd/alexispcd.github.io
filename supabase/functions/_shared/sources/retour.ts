// Chemin de retour dans l'app après une connexion OAuth (coros-oauth). Module pur.
// Le chemin vient du client : il n'est accepté que s'il reste dans l'app, pour que
// le retour ne puisse jamais rediriger ailleurs (open redirect).

export const APP_ORIGIN = "https://alexispcd.github.io"
export const CHEMIN_RETOUR_DEFAUT = "/compte/sources"
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

export type ResultatConnexion = "ok" | "echec"

/**
 * URL complète de retour vers l'app, avec source=<id> et connexion=ok ou
 * connexion=echec ajoutés à la query existante (séparateur ? ou &, fragment gardé
 * à la fin). Le front les lit puis les retire de l'URL.
 */
export const urlRetour = (chemin: unknown, source: string, resultat: ResultatConnexion): string => {
  const url = new URL(cheminRetour(chemin), APP_ORIGIN)
  // Ceinture : un chemin validé reste sur l'origine de l'app.
  if (url.origin !== APP_ORIGIN) return urlRetour(CHEMIN_RETOUR_DEFAUT, source, resultat)
  url.searchParams.set("source", source)
  url.searchParams.set("connexion", resultat)
  return url.toString()
}
