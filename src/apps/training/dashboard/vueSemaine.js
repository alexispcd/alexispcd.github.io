// Calculs purs du dashboard Training (lot T1) : bandeau, histogramme, grille de la
// semaine et tableau des séances. Aucun import React, testé par vueSemaine.test.js.
import {
  BLOCK_LABEL, ZONE_DAYS, intensityOf, cleanText, formatKm, formatPace, formatGoalTime,
  raceDistanceLabel, joursCreneau, shortDayLabel, addDaysISO,
} from '../constants.js'
import { plannedMeters, totalSeconds, keyPaceSec } from '../sessionMath.js'
import { formatShortDay } from '../../../lib/dates.js'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Colonnes de la grille selon le créneau (s.zone), jamais selon l'intensité.
const COLONNES = { A: '1 / span 2', B: '3 / span 3', C: '6 / span 2' }

const LIBELLE_INTENSITE = { A: 'Facile', B: 'Qualité', C: 'Longue' }

const VERDICT_MOT = {
  reussie: 'réussie',
  partiellement: 'partiellement réussie',
  a_retravailler: 'à retravailler',
}

/** Nombre avec une décimale et virgule française : 35,2. */
export const uneDecimale = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

/** Km affichés par le chiffre qui défile : entier tel quel, sinon une décimale. */
export const formaterKm = (km) => (Number.isInteger(km) ? String(km) : uneDecimale(km))

/** Distance et durée réalisées d'une séance, d'après ses laps, ou null sans laps. */
export const realiseLaps = (s) => {
  const laps = s?.actual_laps
  if (!Array.isArray(laps) || laps.length === 0) return null
  const metres = laps.reduce((a, l) => a + (l.distance_m ?? 0), 0)
  const secondes = laps.reduce((a, l) => a + (l.duration_sec ?? 0), 0)
  return metres > 0 ? { metres, secondes } : null
}

/** Séances d'une semaine, triées par date prévue. */
export const seancesDeSemaine = (sessions, weekId) => (sessions ?? [])
  .filter((s) => s.week_id === weekId)
  .sort((a, b) => String(a.scheduled_date ?? '').localeCompare(String(b.scheduled_date ?? '')))

/**
 * Mètres faits d'une semaine : laps réels d'une séance faite, sinon ses km prévus.
 */
export const metresFaits = (seances) => (seances ?? []).reduce((a, s) => {
  if (s.status !== 'done') return a
  const r = realiseLaps(s)
  return a + (r ? r.metres : (s.agg_distance_m ?? plannedMeters(s.steps)))
}, 0)

/** Km faits d'une semaine, arrondis à une décimale (valeur finale du chiffre). */
export const kmFaits = (seances) => Math.round(metresFaits(seances) / 100) / 10

/** Km prévus d'une semaine (agg_distance_m), en km. */
export const kmSemaine = (w) => (w?.agg_distance_m ?? 0) / 1000

/** Compte à rebours de la course : « J-45 », jamais en dessous de J-0. */
export const compteARebours = (jours) => `J-${Math.max(0, jours ?? 0)}`

/**
 * Histogramme : semaines (numéro, km), maximum du plan et blocs regroupés.
 * Un bloc = semaines consécutives de même `block` ; `debut` est la colonne (1 à n).
 */
export const histogramme = (weeks) => {
  const semaines = (weeks ?? []).map((w) => ({ numero: w.week_number, km: kmSemaine(w) }))
  const max = semaines.reduce((m, s) => Math.max(m, s.km), 0)
  const blocs = []
  ;(weeks ?? []).forEach((w, i) => {
    const dernier = blocs.at(-1)
    if (dernier && dernier.block === w.block) dernier.span += 1
    else blocs.push({ block: w.block, libelle: BLOCK_LABEL[w.block] ?? '', debut: i + 1, span: 1 })
  })
  return { semaines, max, blocs }
}

/** Hauteur d'une barre en px : 84 × km / max. */
export const hauteurBarre = (km, max) => (max > 0 ? Math.round((84 * km) / max) : 0)

// Lundi de la semaine d'une date yyyy-MM-dd (lue en UTC).
const lundiDe = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const jour = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDaysISO(iso.slice(0, 10), -((jour + 6) % 7))
}

/**
 * Les 7 jours de la grille, du lundi au dimanche de la semaine de startDate.
 * → [{ iso, jour: 'Lun', numero: 19, aujourdhui }].
 */
export const joursGrille = (startDate, aujourdhui) => {
  if (!startDate) return []
  const lundi = lundiDe(startDate)
  return JOURS.map((jour, i) => {
    const iso = addDaysISO(lundi, i)
    return { iso, jour, numero: Number(iso.slice(8, 10)), aujourdhui: iso === aujourdhui }
  })
}

/** Colonne de grille d'une séance selon son créneau. */
export const colonneZone = (zone) => COLONNES[zone] ?? COLONNES.A

/** Séance du jour de la course. */
export const estCourse = (s, plan) => Boolean(plan?.race_date && s.scheduled_date
  && s.scheduled_date.slice(0, 10) === plan.race_date.slice(0, 10))

/** Taille d'une répétition : « 1000 m » (sans conversion), « 8 min » ou « 2:30 ». */
const tailleRepetition = (step) => {
  if (step.distance_m != null) return `${Math.round(step.distance_m)} m`
  const sec = step.duration_sec ?? 0
  return sec % 60 === 0 ? `${sec / 60} min` : formatPace(sec)
}

/**
 * Titre court d'un bloc de la grille, dans l'ordre : course, répétitions, EF, SL,
 * sinon le titre nettoyé.
 */
export const titreCourt = (s, plan) => {
  if (estCourse(s, plan)) return raceDistanceLabel(plan.race_distance_m)
  const steps = s.steps ?? []
  const intervalles = steps.filter((st) => st.step_type === 'interval')
  if (intervalles.length) return `${intervalles.length} × ${tailleRepetition(intervalles[0])}`
  if (s.type === 'facile' && steps.length) {
    const premiere = steps[0]
    if (premiere.duration_sec != null) return `EF ${Math.round(premiere.duration_sec / 60)} min`
    if (premiere.distance_m != null) return `EF ${formatKm(premiere.distance_m)} km`
  }
  if (s.type === 'sortie_longue') return `SL ${Math.round(plannedMeters(steps) / 1000)} km`
  return cleanText(s.title)
}

/** Intensité affichée (A, B, C) : la course prend la couleur de la zone longue. */
export const intensiteBloc = (s, plan) => (estCourse(s, plan) ? 'C' : intensityOf(s.type))

/** Libellé de zone d'un bloc : Facile, Qualité, Longue, ou Course. */
export const libelleBloc = (s, plan) => (estCourse(s, plan) ? 'Course' : LIBELLE_INTENSITE[intensityOf(s.type)])

/**
 * Vrai pour une séance à faire ou adaptée quand aujourd'hui est le dernier jour de
 * son créneau.
 */
export const dernierJour = (s, aujourdhui) => {
  if (s.status !== 'planned' && s.status !== 'adapted') return false
  const jours = joursCreneau(s.scheduled_date, s.zone)
  return jours.length > 0 && jours.at(-1) === aujourdhui
}

/** Statut d'un bloc : { coche, texte }. */
export const statutBloc = (s, aujourdhui) => {
  if (s.status === 'done') {
    const r = realiseLaps(s)
    return { coche: true, texte: r ? `${formatKm(r.metres)} km` : 'faite' }
  }
  if (s.status === 'skipped') return { coche: false, texte: 'sautée' }
  if (dernierJour(s, aujourdhui)) return { coche: false, texte: 'à faire, dernier jour' }
  return { coche: false, texte: s.status === 'adapted' ? 'adaptée' : 'à faire' }
}

/** Bloc de la grille, prêt à rendre. */
export const blocGrille = (s, plan, aujourdhui) => {
  const { coche, texte } = statutBloc(s, aujourdhui)
  return {
    id: s.id,
    colonne: colonneZone(s.zone),
    intensite: intensiteBloc(s, plan),
    libelle: libelleBloc(s, plan),
    titre: titreCourt(s, plan),
    statut: texte,
    coche,
  }
}

/** Sous-ligne du tableau : « Lun 19, réussie » ou « Mer-Ven, à faire ». */
export const sousLigne = (s) => {
  if (s.status === 'done') {
    const jour = shortDayLabel(s.completed_at ?? s.scheduled_date)
    const mot = VERDICT_MOT[s.analysis?.verdict] ?? 'faite'
    return [jour, mot].filter(Boolean).join(', ')
  }
  const mot = s.status === 'skipped' ? 'sautée' : s.status === 'adapted' ? 'adaptée' : 'à faire'
  return `${ZONE_DAYS[s.zone] ?? ''}, ${mot}`
}

/** Prévu : { valeur, allure } (« 12 km », « 45 min », « ≈ 58 min » ; « 4:03 /km »). */
export const prevu = (s) => {
  const steps = s.steps ?? []
  let valeur
  if (steps.length === 1 && steps[0].distance_m != null) valeur = `${formatKm(steps[0].distance_m)} km`
  else if (steps.length === 1 && steps[0].duration_sec != null) valeur = `${Math.round(steps[0].duration_sec / 60)} min`
  else valeur = `≈ ${Math.round(totalSeconds(steps) / 60)} min`
  const enDuree = steps.length > 0 && steps.every((st) => st.duration_sec != null && st.distance_m == null)
  const cle = s.type === 'facile' && enDuree ? null : keyPaceSec(steps)
  return { valeur, allure: cle != null ? `${formatPace(cle)} /km` : '' }
}

/** Réalisé : { valeur, allure } d'après les laps, sinon un tiret. */
export const realise = (s) => {
  const r = realiseLaps(s)
  if (!r) return { valeur: '-', allure: '' }
  const allure = r.secondes ? `${formatPace(r.secondes / (r.metres / 1000))} /km` : ''
  return { valeur: `${formatKm(r.metres)} km`, allure }
}

/** Ligne du tableau, prête à rendre. */
export const ligneTableau = (s, readOnly) => {
  const p = prevu(s)
  const r = realise(s)
  return {
    id: s.id,
    intensite: intensityOf(s.type),
    titre: cleanText(s.title),
    sousLigne: sousLigne(s),
    prevu: p.valeur,
    prevuAllure: p.allure,
    realise: r.valeur,
    realiseAllure: r.allure,
    montre: Boolean(s.coros_workout_id),
    peutSauter: !readOnly && s.status !== 'done',
    peutEnvoyer: !readOnly && (s.status === 'planned' || s.status === 'adapted'),
  }
}

/** Cellules du bandeau d'un plan passé : distance et année, temps ou objectif, séances. */
export const bandeauPasse = (plan, sessions) => {
  const annee = plan.race_date ? plan.race_date.slice(0, 4) : ''
  const faites = (sessions ?? []).filter((s) => s.status === 'done').length
  const aTemps = plan.race_time_sec != null
  return [
    { etiquette: [raceDistanceLabel(plan.race_distance_m), annee].filter(Boolean).join(' · '), valeur: formatShortDay(plan.race_date) || '-' },
    {
      etiquette: aTemps ? 'Temps' : 'Objectif',
      valeur: formatGoalTime(aTemps ? plan.race_time_sec : plan.goal_time_sec) ?? '-',
    },
    { etiquette: 'Séances', valeur: `${faites} / ${(sessions ?? []).length}` },
  ]
}
