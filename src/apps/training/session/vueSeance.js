// Calculs purs de la page séance Training (lot T2a) : carte de la séance, analyse,
// ressenti, structure et graphe d'allure. Aucun import React, testé par vueSeance.test.js.
import {
  VERDICT, ZONE_DAYS, intensityOf, cleanText, formatPace, formatGoalTime,
} from '../constants.js'
import {
  estimateStepSeconds, estimateStepMeters, groupSteps, plannedMeters, totalSeconds, keyPaceSec,
  stepSizeLabel,
} from '../sessionMath.js'
import { formatShortDay, jourLocal } from '../../../lib/dates.js'
import { painAreaLabel } from '../../../lib/feedback.js'
import { uneDecimale, estCourse } from '../dashboard/vueSemaine.js'

// ── Carte de la séance ──────────────────────────────────────────────────────

const ZONE_DE = { A: 'facile', B: 'qualite', C: 'longue' }

/** Zone de couleur d'une séance (facile, qualite, longue), d'après son type. */
export const zoneSeance = (type) => ZONE_DE[intensityOf(type)]

/** « Facile », « Longue », « Qualité · Tempo », « Qualité · Fractionné », ou « Course ». */
export const libelleIntensite = (session, plan) => {
  if (estCourse(session, plan)) return 'Course'
  switch (session.type) {
    case 'sortie_longue': return 'Longue'
    case 'tempo': return 'Qualité · Tempo'
    case 'fractionne': return 'Qualité · Fractionné'
    default: return 'Facile'
  }
}

/** Séance à faire ou adaptée. */
export const estAFaire = (session) => session.status === 'planned' || session.status === 'adapted'

/** Séance à faire ou adaptée qui a une copie sur la montre. */
export const estSurMontre = (session) => estAFaire(session) && Boolean(session.coros_workout_id)

const MARQUE = { done: 'faite', adapted: 'adaptee', skipped: 'sautee' }
const STATUT = { done: 'Faite', adapted: 'Adaptée', skipped: 'Sautée' }

/** Marque et texte de la pastille d'état. */
export const etatSeance = (status) => ({
  marque: MARQUE[status] ?? 'aFaire',
  texte: STATUT[status] ?? 'À faire',
})

/** « Faite jeu 15 oct », « Prévue jeu 29 oct » (sur la montre), sinon « Créneau Mer-Ven ». */
export const sousLigneSeance = (session) => {
  if (session.status === 'done') {
    const jour = formatShortDay(jourLocal(session.completed_at) ?? session.scheduled_date)
    return jour ? `Faite ${jour}` : 'Faite'
  }
  if (estSurMontre(session) && session.coros_workout_date) {
    return `Prévue ${formatShortDay(session.coros_workout_date)}`
  }
  return `Créneau ${ZONE_DAYS[session.zone] ?? ''}`.trim()
}

/** Erreur de mise à jour de la montre, seulement pour une séance à faire sur la montre. */
export const erreurMontre = (session) => (estSurMontre(session) && session.coros_sync_error) || null

const estCalme = (st) => st.step_type === 'warmup' || st.step_type === 'cooldown'

/** Segments de la BarreStructure : une étape par segment. */
export const segmentsStructure = (steps) => (steps ?? []).map((st) => ({
  duree: Math.max(1, estimateStepSeconds(st) ?? 0),
  type: estCalme(st) ? 'calme' : st.step_type === 'recovery' ? 'recup' : 'effort',
}))

/**
 * Distance prévue en mètres, ou null si une étape n'a ni distance ni allure cible (une
 * récupération en durée sans allure) : la distance ne serait qu'une approximation.
 */
export const distancePrevue = (steps) => {
  const liste = steps ?? []
  if (!liste.length) return null
  if (liste.some((st) => st.distance_m == null && st.target_pace_sec == null)) return null
  const m = plannedMeters(liste)
  return m > 0 ? m : null
}

/** Distance et durée réalisées d'après les laps, ou null sans laps. */
export const realiseSeance = (session) => {
  const laps = session.actual_laps
  if (!Array.isArray(laps) || laps.length === 0) return null
  const metres = laps.reduce((a, l) => a + (l.distance_m ?? 0), 0)
  const secondes = laps.reduce((a, l) => a + (l.duration_sec ?? 0), 0)
  return metres > 0 ? { metres, secondes } : null
}

const chiffre = (etiquette, valeur, unite = '', prevu = '') => ({ etiquette, valeur, unite, prevu })

/**
 * Chiffres de la carte, 1 à 3 : [{ etiquette, valeur, unite, prevu }].
 * Séance faite avec laps : réalisé, prévu dessous. Sinon : prévu seul.
 */
export const chiffresSeance = (session) => {
  const steps = session.steps ?? []
  const duree = Math.round(totalSeconds(steps) / 60)
  const distance = distancePrevue(steps)
  const cle = keyPaceSec(steps)
  const reel = session.status === 'done' ? realiseSeance(session) : null

  if (reel) {
    const allure = reel.secondes / (reel.metres / 1000)
    return [
      chiffre('Distance', uneDecimale(reel.metres / 1000), ' km', distance ? `prévu ≈ ${uneDecimale(distance / 1000)} km` : ''),
      chiffre('Durée', formatGoalTime(reel.secondes), '', duree ? `prévu ≈ ${duree} min` : ''),
      chiffre('Allure moy.', formatPace(allure), ' /km', cle != null ? `clé prévue ${formatPace(cle)}` : ''),
    ]
  }

  const liste = []
  if (duree) liste.push(chiffre('Durée', `≈ ${duree}`, ' min'))
  if (distance) liste.push(chiffre('Distance', `≈ ${uneDecimale(distance / 1000)}`, ' km'))
  if (cle != null) liste.push(chiffre('Allure clé', formatPace(cle), ' /km'))
  return liste
}

// ── Analyse et ressenti ─────────────────────────────────────────────────────

/** « 3 étapes sur 5 dans la cible », parmi les comparaisons hors free, ou null. */
export const etapesDansCible = (comparisons) => {
  const notees = (comparisons ?? []).filter((c) => c.status !== 'free')
  if (!notees.length) return null
  const ok = notees.filter((c) => c.status === 'ok').length
  return `${ok} étape${ok > 1 ? 's' : ''} sur ${notees.length} dans la cible`
}

/**
 * Bloc Analyse d'une séance faite, ou null sans analyse ni comparaison.
 * → { verdict, cible, conseil, repli } : sans verdict, `repli` garde le sens de
 * l'ancien bloc (« … dans la cible. Analyse détaillée indisponible. »).
 */
export const analyseSeance = (session) => {
  const a = session.analysis
  if (session.status !== 'done' || !a) return null
  const cible = etapesDansCible(a.comparisons)
  const conseil = a.advice ? cleanText(a.advice) : null
  const verdict = a.verdict ? VERDICT[a.verdict]?.label ?? null : null
  if (!verdict && !cible && !conseil) return null
  if (verdict) return { verdict, cible, conseil, repli: null }
  let repli = null
  if (cible) repli = `${cible}. Analyse détaillée indisponible.`
  else if (!conseil) repli = 'Analyse indisponible.'
  return { verdict: null, cible: null, conseil, repli }
}

/** Ressenti d'une séance faite : { rpe, note, douleurs }, ou null s'il n'y a rien. */
export const ressentiSeance = (session) => {
  if (session.status !== 'done') return null
  const douleurs = (session.pain_areas ?? []).map(painAreaLabel)
  const note = session.feedback_note?.trim() || null
  if (session.rpe == null && !douleurs.length && !note) return null
  return { rpe: session.rpe ?? null, note, douleurs }
}

// ── Structure ───────────────────────────────────────────────────────────────

/** Écart réalisé moins cible : « -5 s », « +7 s », « +2:25 » au-delà de 60 s. */
export const formatEcart = (delta) => {
  if (delta == null || Number.isNaN(delta)) return ''
  const v = Math.round(delta)
  const signe = v > 0 ? '+' : v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return `${signe}${abs >= 60 ? formatPace(abs) : `${abs} s`}`
}

const dureeCourte = (sec) => (sec >= 60 ? formatPace(sec) : `${Math.round(sec)} s`)

const lapsDe = (session, index) => (session.actual_laps ?? []).filter((l) => l.step_index === index)

/**
 * « , sur 17 s » quand les laps d'une étape durent moins de la moitié du prévu (une
 * répétition interrompue), sinon une chaîne vide.
 */
export const surDuree = (session, index) => {
  const prevue = estimateStepSeconds(session.steps[index]) ?? 0
  const faite = lapsDe(session, index).reduce((a, l) => a + (l.duration_sec ?? 0), 0)
  return faite > 0 && faite < prevue / 2 ? `, sur ${dureeCourte(faite)}` : ''
}

const recupEntre = (steps) => {
  const rec = steps.find((s) => s.step_type === 'recovery')
  if (!rec) return ''
  const taille = stepSizeLabel(rec)
  return taille ? `récup ${taille} entre chaque` : ''
}

const NOM_COURSE = { tempo: 'Tempo', sortie_longue: 'Sortie longue' }

// Taille d'une répétition : les mètres sans conversion (« 1000 m »), sinon la durée.
const tailleRepetition = (st) => (st.distance_m != null ? `${Math.round(st.distance_m)} m` : stepSizeLabel(st))

/**
 * Lignes de la Structure, une par groupe de groupSteps :
 * { nom, detail, marqueur ('calme' | 'effort'), allure, tolerance, cible, realise,
 *   ecart, repetitions: [{ libelle, extra, realise, ecart }] }.
 * Pas faite : allure et tolérance. Faite : cible, réalisé et écart (comparaisons par
 * step_index), un groupe porte une sous-ligne par répétition.
 */
export const lignesStructure = (session) => {
  const steps = session.steps ?? []
  const faite = session.status === 'done'
  const comp = new Map((session.analysis?.comparisons ?? []).map((c) => [c.step_index, c]))
  const groupes = groupSteps(steps)
  const courses = groupes.filter((g) => g.kind === 'single' && !estCalme(g.steps[0]) && g.steps[0].step_type !== 'recovery').length
  let bloc = 0

  const valeurs = (index, st) => {
    const c = comp.get(index)
    return {
      cible: st.target_pace_sec != null ? formatPace(st.target_pace_sec) : '',
      realise: c?.actual_pace != null ? formatPace(c.actual_pace) : '-',
      ecart: c ? formatEcart(c.delta_sec) : '',
    }
  }

  return groupes.map((g) => {
    if (g.kind === 'repeat') {
      const reps = g.steps
        .map((st, k) => ({ st, index: g.start + k }))
        .filter(({ st }) => st.step_type === 'interval')
      const base = reps[0]?.st ?? g.steps[0]
      const ligne = {
        nom: `${reps.length} × ${tailleRepetition(base)}`,
        detail: recupEntre(g.steps),
        marqueur: 'effort',
        allure: base.target_pace_sec != null ? formatPace(base.target_pace_sec) : '',
        tolerance: base.target_pace_sec != null ? `±${base.pace_tolerance_sec ?? 5} s` : '',
        cible: base.target_pace_sec != null ? formatPace(base.target_pace_sec) : '',
        realise: '',
        ecart: '',
        repetitions: [],
      }
      if (faite) {
        ligne.repetitions = reps.map(({ st, index }, k) => {
          const v = valeurs(index, st)
          return {
            libelle: `Rép ${st.repeat_index ?? k + 1}`,
            extra: surDuree(session, index),
            realise: v.realise,
            ecart: v.ecart,
          }
        })
      }
      return ligne
    }

    const st = g.steps[0]
    let nom
    if (st.step_type === 'warmup') nom = 'Échauffement'
    else if (st.step_type === 'cooldown') nom = 'Retour au calme'
    else if (st.step_type === 'recovery') nom = 'Récupération'
    else nom = courses > 1 ? `Bloc ${++bloc}` : NOM_COURSE[session.type] ?? 'Endurance'
    const v = faite ? valeurs(g.start, st) : null
    const allure = st.target_pace_sec != null ? formatPace(st.target_pace_sec) : ''
    return {
      nom,
      detail: stepSizeLabel(st),
      marqueur: estCalme(st) ? 'calme' : 'effort',
      allure,
      tolerance: allure ? `±${st.pace_tolerance_sec ?? 5} s` : '',
      cible: allure,
      realise: v?.realise ?? '',
      ecart: v?.ecart ?? '',
      repetitions: [],
    }
  })
}

// ── Graphe d'allure ─────────────────────────────────────────────────────────

const genre = (st) => (estCalme(st) ? 'calme' : st.step_type === 'recovery' ? 'recup' : 'effort')

/**
 * Vue par étape : { duree, cible, tolerance, genre, realise } par étape. Durée et allure
 * réalisées depuis les laps de chaque step_index (somme des durées, durée / distance) ;
 * une étape sans lap prend sa durée estimée et n'a pas de réalisé.
 */
export const etapesGraphe = (session) => (session.steps ?? []).map((st, i) => {
  const laps = lapsDe(session, i)
  const secondes = laps.reduce((a, l) => a + (l.duration_sec ?? 0), 0)
  const metres = laps.reduce((a, l) => a + (l.distance_m ?? 0), 0)
  const aLaps = laps.length > 0 && secondes > 0
  return {
    duree: aLaps ? secondes : estimateStepSeconds(st) ?? 0,
    cible: st.target_pace_sec ?? null,
    tolerance: st.pace_tolerance_sec ?? 5,
    genre: genre(st),
    realise: aLaps && metres > 0 ? secondes / (metres / 1000) : null,
  }
})

/** Étape couvrant le km k (1 à n) : celle qui contient le milieu du km ; au-delà, la dernière. */
export const etapeDuKm = (steps, k) => {
  const d = (k - 0.5) * 1000
  let fin = 0
  for (let i = 0; i < steps.length; i++) {
    fin += estimateStepMeters(steps[i]) ?? 0
    if (d <= fin) return i
  }
  return steps.length - 1
}

/** Vue par km : un palier par entrée de km_laps, avec la cible de l'étape couvrante. */
export const etapesKm = (session) => {
  const steps = session.steps ?? []
  return (session.km_laps ?? []).map((l, i) => {
    const st = steps[etapeDuKm(steps, i + 1)] ?? {}
    return {
      duree: l.duration_sec ?? 0,
      cible: st.target_pace_sec ?? null,
      tolerance: st.pace_tolerance_sec ?? 5,
      genre: st.step_type ? genre(st) : 'effort',
      realise: l.avg_pace_sec ?? null,
    }
  })
}

/** Ligne du km touché : « Km 3 · 5:48 /km · cible 5:50 · -2 s », ou sans cible. */
export const ligneKm = (etape, index) => {
  const km = `Km ${index + 1}`
  if (!etape || etape.realise == null) return km
  const allure = `${km} · ${formatPace(etape.realise)} /km`
  if (etape.cible == null) return allure
  return `${allure} · cible ${formatPace(etape.cible)} · ${formatEcart(Math.round(etape.realise) - etape.cible)}`
}

/** Géométrie du graphe, en unités du viewBox. */
export const GRAPHE = { largeur: 330, hauteur: 156, x0: 34, x1: 328, y0: 8, y1: 132 }

/**
 * Graphe d'allure, rapide en haut : axe du temps proportionnel à la durée, allures
 * toutes les minutes, graduations du temps toutes les 15 min (30 au-delà de 75 min)
 * et durée totale à droite.
 * → { vide, grille, bandes, reel, graduations, zones }.
 * - bandes : { x, x2, y, h, cy, genre } pour chaque étape avec allure cible.
 * - reel : polylignes (« x,y x,y »), coupées là où une étape n'a pas de réalisé.
 * - zones : { x, w } de chaque étape, sur toute la hauteur (toucher en vue par km).
 */
export const graphe = (etapes, G = GRAPHE) => {
  const total = etapes.reduce((a, e) => a + e.duree, 0)
  let lo = Infinity
  let hi = -Infinity
  etapes.forEach((e) => {
    if (e.cible != null) { lo = Math.min(lo, e.cible - e.tolerance); hi = Math.max(hi, e.cible + e.tolerance) }
    if (e.realise != null) { lo = Math.min(lo, e.realise); hi = Math.max(hi, e.realise) }
  })
  if (!(total > 0) || !Number.isFinite(lo)) {
    return { vide: true, grille: [], bandes: [], reel: [], graduations: [], zones: [] }
  }
  lo = Math.floor((lo - 10) / 30) * 30
  hi = Math.ceil((hi + 10) / 30) * 30
  const y = (p) => G.y0 + ((p - lo) / (hi - lo)) * (G.y1 - G.y0)
  const x = (t) => G.x0 + (t / total) * (G.x1 - G.x0)
  const r = (n) => Math.round(n * 10) / 10

  const grille = []
  for (let m = Math.ceil(lo / 60) * 60; m <= hi; m += 60) grille.push({ y: r(y(m)), libelle: formatPace(m) })

  const bandes = []
  const zones = []
  const reel = []
  let courant = []
  let t = 0
  etapes.forEach((e) => {
    const xa = x(t)
    const xb = x(t + e.duree)
    zones.push({ x: r(xa), w: r(xb - xa) })
    if (e.cible != null) {
      bandes.push({
        x: r(xa),
        x2: r(xb),
        w: r(Math.max(1, xb - xa - 1)),
        y: r(y(e.cible - e.tolerance)),
        h: r(Math.max(3, y(e.cible + e.tolerance) - y(e.cible - e.tolerance))),
        cy: r(y(e.cible)),
        genre: e.genre === 'calme' ? 'calme' : 'effort',
      })
    }
    if (e.realise != null) {
      courant.push(`${r(xa)},${r(y(e.realise))}`, `${r(xb)},${r(y(e.realise))}`)
    } else if (courant.length) {
      reel.push(courant.join(' '))
      courant = []
    }
    t += e.duree
  })
  if (courant.length) reel.push(courant.join(' '))

  const minutes = total / 60
  const pas = minutes > 75 ? 30 : 15
  const graduations = []
  for (let m = 0; m <= minutes; m += pas) {
    graduations.push({ x: r(x(m * 60)), ancre: m === 0 ? 'start' : 'middle', libelle: String(m) })
  }
  graduations.push({ x: G.x1, ancre: 'end', libelle: `${Math.round(minutes)} min` })
  // La durée totale l'emporte sur une graduation trop proche d'elle.
  if (graduations.length > 2 && G.x1 - graduations.at(-2).x < 40) graduations.splice(graduations.length - 2, 1)

  return { vide: false, grille, bandes, reel, graduations, zones }
}
