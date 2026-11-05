// Calculs purs de l'accueil Renfo : semaine en cours et phrases de la carte
// « Prochaine séance ». Dates calendaires locales (yyyy-MM-dd).

import { MOIS_COURTS, MOIS_LONGS, formatShortDay, jourLocal } from '../../lib/dates.js'
import { addDaysISO, mondayOf } from './dates.js'
import { raisonSuggestion, titreSeance } from '../../../supabase/functions/_shared/strength/compose.ts'

// Jour local d'un horodatage, partagé avec l'Historique des séances.
export { jourLocal }

/**
 * Séances faites de la semaine du lundi au dimanche de `today` (jour local de
 * completed_at). `jours` : 7 booléens, lundi en premier.
 */
export const semaineEnCours = (sessions, today, objectif) => {
  const lundi = mondayOf(today)
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(lundi, i))
  const jours = dates.map(() => false)
  let compte = 0
  for (const s of sessions ?? []) {
    const i = dates.indexOf(jourLocal(s?.completed_at))
    if (i < 0) continue
    compte += 1
    jours[i] = true
  }
  return { lundi, dates, compte, jours, atteint: compte >= objectif }
}

const jourMois = (iso) => {
  const [, m, d] = iso.split('-').map(Number)
  return { jour: d, mois: MOIS_COURTS[m - 1] }
}

/** Semaine d'un lundi : « 2-8 nov », « 26 oct-1 nov ». */
export const libelleSemaine = (lundi) => {
  const debut = jourMois(lundi)
  const fin = jourMois(addDaysISO(lundi, 6))
  return debut.mois === fin.mois
    ? `${debut.jour}-${fin.jour} ${fin.mois}`
    : `${debut.jour} ${debut.mois}-${fin.jour} ${fin.mois}`
}

/** « Jambes et tronc : rien depuis mar 20 oct », ou « … : pas encore travaillé ». */
export const phraseSuggestion = (composition, sessions) => {
  const titre = titreSeance(composition.supersets.map((s) => s.focus))
  const { depuis } = raisonSuggestion(composition, sessions)
  return depuis
    ? `${titre} : rien depuis ${formatShortDay(jourLocal(depuis))}`
    : `${titre} : pas encore travaillé`
}

/** « Créée dim 25 oct, pas encore faite ». */
export const phraseEnAttente = (session) => {
  const jour = jourLocal(session?.created_at)
  return jour ? `Créée ${formatShortDay(jour)}, pas encore faite` : 'Pas encore faite'
}

export const INTENSITE_LABELS = { legere: 'Légère', normale: 'Normale', soutenue: 'Soutenue' }

/** « 1 superset », « 3 supersets ». */
export const libelleSupersets = (n) => `${n} superset${n > 1 ? 's' : ''}`

/** « Normale · 3 supersets ». */
export const resumeComposition = (intensity, n) =>
  `${INTENSITE_LABELS[intensity] ?? ''} · ${libelleSupersets(n)}`

/**
 * Sous-ligne de la ligne « Historique des séances » : séances faites dans le mois de
 * `today` (jour local de completed_at). « 3 séances faites en novembre »,
 * « 1 séance faite en novembre », « Aucune séance en novembre ».
 */
export const ligneHistorique = (sessions, today) => {
  const mois = today.slice(0, 7)
  const n = (sessions ?? []).filter((s) => jourLocal(s?.completed_at)?.slice(0, 7) === mois).length
  const nom = MOIS_LONGS[Number(mois.slice(5, 7)) - 1]
  if (n === 0) return `Aucune séance en ${nom}`
  return n > 1 ? `${n} séances faites en ${nom}` : `1 séance faite en ${nom}`
}
