// Textes et listes de la page Sources de données, sans React. Tout vient du
// catalogue commun : aucun nom de service écrit en dur. Testé par sources.test.js.

import { SOURCES, getSource, nomSource } from '../../../supabase/functions/_shared/sources/catalog.ts'

const CAPACITES = [
  ['forme', 'forme'],
  ['activites', 'activités et laps'],
  ['envoi', 'envoi sur la montre'],
]

/** Ce que la source sait faire, dans l'ordre du catalogue (« forme, activités et laps, envoi sur la montre »). */
export const capacitesDe = (id) => {
  const capacites = getSource(id)?.capacites ?? {}
  return CAPACITES.filter(([cle]) => capacites[cle]).map(([, texte]) => texte).join(', ')
}

/** Titre de la feuille d'actions d'une source connectée : « Coros · forme, activités et laps, envoi sur la montre ». */
export const titreActions = (id) => {
  const capacites = capacitesDe(id)
  return capacites ? `${nomSource(id)} · ${capacites}` : nomSource(id)
}

/** Titre de la feuille d'actions d'une connexion expirée. */
export const titreExpiree = (id) =>
  `La connexion à ${nomSource(id)} a expiré. Reconnecte-la pour retrouver tes activités et envoyer tes séances.`

/** « A », « A et B », « A, B et C ». */
const enumerer = (noms) =>
  noms.length <= 1 ? (noms[0] ?? '') : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`

/** Titre de la confirmation de déconnexion, selon les plans en cours qui utilisent la source. */
export const phraseDeconnexion = (id, plans = []) => {
  const nom = nomSource(id)
  if (plans.length === 0) return `Aucun plan n'utilise ${nom}. Ton compte ${nom} n'est pas modifié.`
  const verbe = plans.length > 1 ? 'utilisent' : 'utilise'
  return `${enumerer(plans)} ${verbe} ${nom}. Sans ${nom}, plus de validation avec tes activités ni d'envoi sur ta montre. `
    + `Les séances déjà envoyées y restent et ton compte ${nom} n'est pas modifié.`
}

/** Sources du compte affichées, dans l'ordre du catalogue, seulement les sources connues. */
export const sourcesAffichees = (statuts) =>
  SOURCES.flatMap((s) => {
    const statut = statuts.find((x) => x.id === s.id)
    return statut ? [{ ...s, etat: statut.etat }] : []
  })

/** Sources du catalogue pas encore connectées (ni connectées, ni expirées). */
export const sourcesAjoutables = (statuts) =>
  SOURCES.filter((s) => !statuts.some((x) => x.id === s.id))
