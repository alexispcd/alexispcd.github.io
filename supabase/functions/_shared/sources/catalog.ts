// Catalogue des sources de données (montres, applis de sport). Module pur, sans
// import Deno ni npm : le front pourra l'importer par chemin relatif, comme le
// catalogue Renfo (src/apps/renfo/content.js). Aucune URL ni identifiant OAuth
// ici : la config de connexion reste côté serveur (connexions.ts, coros-oauth).

/** Ce qu'une source sait fournir ou recevoir. */
export interface Capacites {
  /** Données de forme (VO2max, seuil, prédictions). */
  forme: boolean
  /** Activités réalisées, avec leurs laps. */
  activites: boolean
  /** Envoi des séances planifiées sur la montre. */
  envoi: boolean
}

export interface Source {
  id: string
  nom: string
  /** Logo officiel de la marque, chemin public du front (public/sources, précaché). */
  logo: string
  capacites: Capacites
}

export const SOURCES: readonly Source[] = [
  { id: "coros", nom: "Coros", logo: "/sources/coros.png", capacites: { forme: true, activites: true, envoi: true } },
]

/** Texte affiché à la place du nom quand la source est inconnue ou absente. */
export const NOM_SOURCE_INCONNUE = "ta source de données"

/** Source du catalogue, ou null si l'id est inconnu ou nul. */
export const getSource = (id: string | null | undefined): Source | null =>
  SOURCES.find((s) => s.id === id) ?? null

/** Nom affiché d'une source, texte neutre si elle est inconnue ou nulle. */
export const nomSource = (id: string | null | undefined): string =>
  getSource(id)?.nom ?? NOM_SOURCE_INCONNUE
