// Calculs purs du bloc « Aujourd'hui » de l'Accueil (lot A2) : widget Séance, widget
// Semaine et bande Renfo. Dates en jours locaux (yyyy-MM-dd), `aujourdhui` passé en
// paramètre. Aucun import React, testé par aujourdhui.test.js.
import {
  VERDICT, ZONE_DAYS, joursCreneau, cleanText, formatPace, formatGoalTime, addDaysISO,
} from '../training/constants.js'
import { keyPaceSec, totalSeconds } from '../training/sessionMath.js'
import {
  titreCourt, estCourse, intensiteBloc, kmFaits, realiseLaps, dernierJour, uneDecimale,
} from '../training/dashboard/vueSemaine.js'
import { segmentsStructure } from '../training/session/vueSeance.js'
import { JOURS_COURTS, formatShortDay, jourLocal } from '../../lib/dates.js'
import { phraseSuggestion, resumeComposition, semaineEnCours } from '../renfo/accueil.js'
import { titreAffiche } from '../renfo/content.js'
import { compositionDe, titreSeance } from '../../../supabase/functions/_shared/strength/compose.ts'

const ZONE = { A: 'facile', B: 'qualite', C: 'longue' }
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const INITIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const lireJour = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Lundi de la semaine d'une date yyyy-MM-dd. */
const lundiDe = (iso) => addDaysISO(iso, -((lireJour(iso).getUTCDay() + 6) % 7))

/** « sam 7 nov » : date du titre « Aujourd'hui ». */
export const dateDuJour = (aujourdhui) => formatShortDay(aujourdhui)

/** Zone de couleur d'une séance (facile, qualite, longue) ; la course prend la longue. */
export const zoneDe = (s, plan) => ZONE[intensiteBloc(s, plan)]

const aFaire = (s) => s.status === 'planned' || s.status === 'adapted'
const creneauOuvert = (s, aujourdhui) => joursCreneau(s.scheduled_date, s.zone).includes(aujourdhui)

/**
 * Semaine en cours : la dernière semaine commencée à `aujourdhui` (la première si
 * aucune), comme currentWeekNumber, et la suivante.
 */
export const semainesDu = (weeks, aujourdhui) => {
  const liste = weeks ?? []
  let courante = liste[0] ?? null
  for (const w of liste) if (w.start_date && w.start_date.slice(0, 10) <= aujourdhui) courante = w
  const suivante = courante ? liste.find((w) => w.week_number === courante.week_number + 1) ?? null : null
  return { courante, suivante }
}

const seancesDe = (sessions, week) => (week ? (sessions ?? []).filter((s) => s.week_id === week.id) : [])

/**
 * Prochaine séance : la première à faire ou adaptée dont le créneau commence après
 * aujourd'hui, cette semaine ou la suivante. → { zone, titre, quand } ou null ;
 * `quand` : « demain » si son créneau commence demain, sinon « dès lun 9 ».
 */
export const prochaineSeance = (sessions, plan, aujourdhui) => {
  const candidates = (sessions ?? [])
    .filter(aFaire)
    .map((s) => ({ s, debut: joursCreneau(s.scheduled_date, s.zone)[0] ?? s.scheduled_date?.slice(0, 10) }))
    .filter(({ debut }) => debut && debut > aujourdhui)
    .sort((a, b) => a.debut.localeCompare(b.debut))
  const premiere = candidates[0]
  if (!premiere) return null
  const { s, debut } = premiere
  const quand = debut === addDaysISO(aujourdhui, 1)
    ? 'demain'
    : `dès ${JOURS_COURTS[lireJour(debut).getUTCDay()]} ${lireJour(debut).getUTCDate()}`
  return { zone: zoneDe(s, plan), titre: titreCourt(s, plan), quand }
}

const LIBELLE_VERDICT = Object.fromEntries(Object.entries(VERDICT).map(([k, v]) => [k, v.label]))

/**
 * Widget Séance, premier état qui s'applique : faite aujourd'hui, créneau ouvert,
 * semaine terminée, sautée au créneau ouvert, repos.
 * → { etat, zone (null : muted), libelle, valeur, barree, sousLigne, bas, sessionId, label }.
 * `bas` : { verdict, titre } (faite), { segments, duree } (du jour),
 * { titre: 'Semaine prochaine', texte } (terminée), { titre: 'Prochaine', prochaine } (sautée, repos).
 */
export const widgetSeance = ({ plan, weeks, sessions, aujourdhui }) => {
  const { courante, suivante } = semainesDu(weeks, aujourdhui)
  const semaine = seancesDe(sessions, courante)
  const prochaine = prochaineSeance([...semaine, ...seancesDe(sessions, suivante)], plan, aujourdhui)
  const basProchaine = prochaine ? { titre: 'Prochaine', prochaine } : null

  // 1. Faite aujourd'hui.
  const faite = (sessions ?? []).find((s) => s.status === 'done' && jourLocal(s.completed_at) === aujourdhui)
  if (faite) {
    const r = realiseLaps(faite)
    const verdict = LIBELLE_VERDICT[faite.analysis?.verdict] ?? 'Faite'
    const titre = cleanText(faite.title)
    const valeur = r ? `${uneDecimale(r.metres / 1000)} km` : titreCourt(faite, plan)
    return {
      etat: 'faite',
      zone: zoneDe(faite, plan),
      libelle: 'Séance faite',
      valeur,
      sousLigne: r ? `${formatPace(r.secondes / (r.metres / 1000))} /km · ${formatGoalTime(r.secondes)}` : 'Faite',
      bas: { verdict, titre },
      sessionId: faite.id,
      label: `Séance faite : ${titre}, ${valeur}, ${verdict}`,
    }
  }

  // 2. À faire ou adaptée, créneau ouvert aujourd'hui.
  const duJour = semaine.find((s) => aFaire(s) && creneauOuvert(s, aujourdhui))
  if (duJour) {
    const course = estCourse(duJour, plan)
    const cle = keyPaceSec(duJour.steps ?? [])
    const jours = joursCreneau(duJour.scheduled_date, duJour.zone)
    const fin = dernierJour(duJour, aujourdhui)
      ? 'dernier jour'
      : `d'ici ${JOURS_LONGS[lireJour(jours.at(-1)).getUTCDay()]}`
    const minutes = Math.round(totalSeconds(duJour.steps ?? []) / 60)
    const valeur = titreCourt(duJour, plan)
    const libelle = course ? 'Course' : 'Séance du jour'
    return {
      etat: 'duJour',
      zone: zoneDe(duJour, plan),
      libelle,
      valeur,
      sousLigne: cle != null ? `à ${formatPace(cle)} /km, ${fin}` : fin,
      bas: { segments: segmentsStructure(duJour.steps ?? []), duree: minutes ? `≈ ${minutes} min` : '' },
      sessionId: duJour.id,
      label: `${libelle} : ${cleanText(duJour.title)}, ${fin}`,
    }
  }

  // 3. Semaine terminée : plus rien à faire, au moins une séance faite.
  const faites = semaine.filter((s) => s.status === 'done').length
  if (semaine.length && faites > 0 && !semaine.some(aFaire)) {
    const km = seancesDe(sessions, suivante).reduce((a, s) => a + (s.agg_distance_m ?? 0), 0)
    return {
      etat: 'terminee',
      zone: null,
      libelle: 'Semaine terminée',
      valeur: `${faites} sur ${semaine.length}`,
      sousLigne: faites > 1 ? 'séances faites' : 'séance faite',
      bas: suivante ? { titre: 'Semaine prochaine', texte: `S${suivante.week_number} · ${uneDecimale(km / 1000)} km prévus` } : null,
      sessionId: null,
      label: `Semaine terminée, ${faites} sur ${semaine.length} séances faites`,
    }
  }

  // 4. Sautée, créneau ouvert.
  const sautee = semaine.find((s) => s.status === 'skipped' && creneauOuvert(s, aujourdhui))
  if (sautee) {
    return {
      etat: 'sautee',
      zone: null,
      libelle: 'Séance sautée',
      valeur: titreCourt(sautee, plan),
      barree: true,
      sousLigne: `Créneau ${ZONE_DAYS[sautee.zone] ?? ''}`.trim(),
      bas: basProchaine,
      sessionId: null,
      label: `Séance sautée : ${cleanText(sautee.title)}`,
    }
  }

  // 5. Repos.
  return {
    etat: 'repos',
    zone: null,
    libelle: 'Séance du jour',
    valeur: 'Repos',
    sousLigne: 'Rien de prévu aujourd\'hui',
    bas: basProchaine,
    sessionId: null,
    label: 'Repos, rien de prévu aujourd\'hui',
  }
}

/**
 * Jour de la semaine où poser la marque d'une séance : faite, son jour réel ; à faire
 * ou adaptée, aujourd'hui si son créneau est ouvert, sinon sa date prévue ; sautée,
 * sa date prévue.
 */
export const jourDeMarque = (s, aujourdhui) => {
  if (s.status === 'done') return jourLocal(s.completed_at) ?? s.scheduled_date?.slice(0, 10)
  if (aFaire(s) && creneauOuvert(s, aujourdhui)) return aujourdhui
  return s.scheduled_date?.slice(0, 10) ?? null
}

const MARQUE = { done: 'faite', planned: 'aFaire', adapted: 'adaptee', skipped: 'sautee' }

/**
 * Widget Semaine : { numero, faits (km), prevus (km), part (0 à 1), jours, label }.
 * jours : 7 entrées { initiale, iso, aujourdhui, marque: { etat, zone } | null } ;
 * deux séances le même jour : la première.
 */
export const widgetSemaine = ({ plan, weeks, sessions, aujourdhui }) => {
  const { courante } = semainesDu(weeks, aujourdhui)
  const semaine = seancesDe(sessions, courante)
  const faits = kmFaits(semaine)
  const prevus = Math.round(semaine.reduce((a, s) => a + (s.agg_distance_m ?? 0), 0) / 100) / 10
  const lundi = lundiDe(courante?.start_date?.slice(0, 10) ?? aujourdhui)
  const jours = INITIALES.map((initiale, i) => {
    const iso = addDaysISO(lundi, i)
    const s = semaine.find((x) => jourDeMarque(x, aujourdhui) === iso)
    return {
      initiale,
      iso,
      aujourdhui: iso === aujourdhui,
      marque: s ? { etat: MARQUE[s.status] ?? 'aFaire', zone: zoneDe(s, plan) } : null,
    }
  })
  const numero = courante?.week_number ?? null
  return {
    numero,
    faits,
    prevus,
    part: prevus > 0 ? Math.min(1, faits / prevus) : 0,
    jours,
    label: `Semaine ${numero ?? ''}, ${uneDecimale(faits)} km faits sur ${uneDecimale(prevus)} km prévus`,
  }
}

/** Bloc de course : { sansPlan: true } sans plan actif, sinon les deux widgets. */
export const vueCourse = ({ plan, weeks, sessions, aujourdhui }) => {
  if (!plan) return { sansPlan: true }
  return {
    sansPlan: false,
    seance: widgetSeance({ plan, weeks, sessions, aujourdhui }),
    semaine: widgetSemaine({ plan, weeks, sessions, aujourdhui }),
  }
}

/**
 * Bande Renfo, toujours là avec un profil (lot A2b), premier cas qui s'applique :
 * séance créée pas encore faite (elle ouvre la séance) ; objectif de la semaine pas
 * atteint (la suggestion, elle ouvre /renfo) ; objectif atteint (« Objectif atteint »,
 * « Prochaine : » et la suggestion, elle ouvre /renfo). Sans suggestion possible :
 * « Objectif atteint » ou « Crée ta prochaine séance », sans détail. Sans profil : null.
 * → { ligne, titre, detail, cible, label }.
 */
export const bandeRenfo = ({ profile, done, pending, suggestion, aujourdhui }) => {
  if (!profile) return null
  if (pending) {
    const c = compositionDe(pending.content)
    const titre = titreAffiche(pending.title)
    return {
      ligne: 'Renfo · créée, pas encore faite',
      titre,
      detail: resumeComposition(c.intensity, c.supersets.length),
      cible: `/renfo/session/${pending.id}`,
      label: `Renfo, séance créée pas encore faite : ${titre}`,
    }
  }
  const objectif = profile.frequency ?? 1
  const semaine = semaineEnCours(done, aujourdhui, objectif)
  const compte = `${semaine.compte} sur ${objectif} cette semaine`
  const suggere = suggestion?.supersets?.length ? titreSeance(suggestion.supersets.map((s) => s.focus)) : null

  if (semaine.atteint) {
    return {
      ligne: `Renfo · ${compte}`,
      titre: 'Objectif atteint',
      detail: suggere ? `Prochaine : ${suggere}` : null,
      cible: '/renfo',
      label: `Renfo, ${compte}, objectif atteint${suggere ? `, prochaine : ${suggere}` : ''}`,
    }
  }
  if (!suggere) {
    return {
      ligne: `Renfo · ${compte}`,
      titre: 'Crée ta prochaine séance',
      detail: null,
      cible: '/renfo',
      label: `Renfo, ${compte}, crée ta prochaine séance`,
    }
  }
  return {
    ligne: `Renfo · ${compte}`,
    titre: suggere,
    detail: phraseSuggestion(suggestion, done),
    cible: '/renfo',
    label: `Renfo, ${compte}, suggestion : ${suggere}`,
  }
}
