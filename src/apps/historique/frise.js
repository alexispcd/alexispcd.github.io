// Calcul pur de l'Historique des séances : une frise du jour le plus récent au plus
// ancien, un jour par ligne, course et Renfo mêlés. Dates calendaires locales
// (yyyy-MM-dd). Testé par frise.test.js (node --test).

import { JOURS_COURTS, MOIS_LONGS, jourLocal } from '../../lib/dates.js'
import {
  VERDICT, ZONE_DAYS, addDaysISO, cleanText, formatGoalTime, formatPace, intensityOf, raceDistanceLabel,
} from '../training/constants.js'
import { titreAffiche } from '../renfo/content.js'

// Intensité rendue d'une séance de course (couleur de sa marque).
const ZONE_MARQUE = { A: 'facile', B: 'qualite', C: 'longue' }

const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1)

/** Colonne de date : « Sam 31 ». */
export const libelleJour = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${majuscule(JOURS_COURTS[date.getUTCDay()])} ${d}`
}

/** Nom du mois : « Novembre » dans l'année en cours, « Décembre 2025 » sinon. */
export const libelleMoisFrise = (mois, aujourdhui) => {
  const [y, m] = mois.split('-').map(Number)
  const nom = majuscule(MOIS_LONGS[m - 1])
  return String(y) === aujourdhui.slice(0, 4) ? nom : `${nom} ${y}`
}

/** Mètres → « 9,6 km », toujours une décimale. */
const km = (metres) => `${(metres / 1000).toFixed(1).replace('.', ',')} km`

/** Somme des laps d'une séance faite : { distance, duree } en mètres et secondes. */
const sommeLaps = (laps) => {
  let distance = 0
  let duree = 0
  for (const lap of Array.isArray(laps) ? laps : []) {
    if (Number.isFinite(lap?.distance_m) && lap.distance_m > 0) distance += lap.distance_m
    if (Number.isFinite(lap?.duration_sec) && lap.duration_sec > 0) duree += lap.duration_sec
  }
  return { distance, duree }
}

/** « 9,6 km · 5:03 /km · 48:44 », ou ce qui est connu ; null sans laps. */
const chiffresCourse = ({ distance, duree }) => {
  const parts = []
  if (distance > 0) parts.push(km(distance))
  if (distance > 0 && duree > 0) parts.push(`${formatPace(Math.round(duree / (distance / 1000)))} /km`)
  if (duree > 0) parts.push(formatGoalTime(duree))
  return parts.length ? parts.join(' · ') : null
}

/** « Séance réussie · effort 8 / 10 », « Séance réussie », « Effort 8 / 10 », ou null. */
const legendeCourse = (verdict, rpe) => {
  const libelle = VERDICT[verdict]?.label ?? null
  const effort = rpe != null ? `effort ${rpe} / 10` : null
  if (libelle && effort) return `${libelle} · ${effort}`
  if (libelle) return libelle
  return effort ? majuscule(effort) : null
}

const effortRenfo = (rpe) => (rpe != null ? `Effort ${rpe} / 10` : null)

/** « 87,7 km · 12 séances », « 2 séances », « Aucune séance ». */
const totalMois = ({ metres, seances }) => {
  if (seances === 0) return 'Aucune séance'
  const compte = `${seances} séance${seances > 1 ? 's' : ''}`
  return metres > 0 ? `${km(metres)} · ${compte}` : compte
}

/** Plan qui contient le jour (start_date à race_date), ou null. */
const planDuJour = (plans, iso) =>
  plans.find((p) => p.start_date && p.race_date && p.start_date.slice(0, 10) <= iso && iso <= p.race_date.slice(0, 10)) ?? null

/** Jour de la semaine, lundi 0 à dimanche 6. */
const jourSemaine = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

const ajouter = (map, cle, valeur) => {
  if (!map.has(cle)) map.set(cle, [])
  map.get(cle).push(valeur)
}

/**
 * Frise de l'Historique des séances.
 * - seances : séances Training faites ou sautées ({ id, plan_id, title, status, type,
 *   zone, completed_at, scheduled_date, actual_laps, rpe, verdict }).
 * - plans : plans Training prêts ({ id, race_name, race_date, start_date,
 *   race_distance_m, goal_time_sec, race_time_sec }).
 * - renfo : séances Renfo faites ({ id, title, completed_at, rpe, estimated_min }).
 * - aujourdhui : yyyy-MM-dd local.
 * Renvoie { vide, elements } ; `vide` quand aucune séance n'est faite. Éléments, de
 * haut en bas : `mois` { titre, total }, `seance` { date, aujourdhui, marque, titre,
 * chiffres, legende, lien }, `course` (jalon, non touchable), `repos`, `debut`
 * { texte }, `filet` (entre deux semaines d'un plan). `date` n'est posée que sur la
 * première ligne du jour ; `finRail` coupe le rail avant un mois et en bas.
 */
export const construireFrise = ({ seances = [], plans = [], renfo = [], aujourdhui }) => {
  const parJour = new Map()
  const parMois = new Map()
  const totalDe = (iso) => {
    const mois = iso.slice(0, 7)
    if (!parMois.has(mois)) parMois.set(mois, { metres: 0, seances: 0 })
    return parMois.get(mois)
  }

  for (const s of seances) {
    if (s.status === 'done') {
      const iso = jourLocal(s.completed_at) ?? s.scheduled_date?.slice(0, 10)
      if (!iso || iso > aujourdhui) continue
      const laps = sommeLaps(s.actual_laps)
      const total = totalDe(iso)
      total.metres += laps.distance
      total.seances += 1
      ajouter(parJour, iso, {
        type: 'seance',
        tri: s.completed_at ?? '',
        marque: { etat: 'faite', zone: ZONE_MARQUE[intensityOf(s.type)] },
        titre: cleanText(s.title),
        chiffres: chiffresCourse(laps),
        legende: legendeCourse(s.verdict, s.rpe),
        lien: `/training/plan/${s.plan_id}/session/${s.id}`,
      })
    } else if (s.status === 'skipped') {
      const iso = s.scheduled_date?.slice(0, 10)
      if (!iso || iso > aujourdhui) continue
      ajouter(parJour, iso, {
        type: 'seance',
        tri: '',
        marque: { etat: 'sautee', zone: ZONE_MARQUE[intensityOf(s.type)] },
        titre: cleanText(s.title),
        chiffres: ZONE_DAYS[s.zone] ? `Sautée · créneau ${ZONE_DAYS[s.zone]}` : 'Sautée',
        legende: null,
        lien: `/training/plan/${s.plan_id}/session/${s.id}`,
      })
    }
  }

  for (const r of renfo) {
    const iso = jourLocal(r.completed_at)
    if (!iso || iso > aujourdhui) continue
    totalDe(iso).seances += 1
    const minutes = Number(r.estimated_min)
    ajouter(parJour, iso, {
      type: 'seance',
      tri: r.completed_at,
      marque: { etat: 'faite', zone: 'ink' },
      titre: titreAffiche(r.title),
      chiffres: Number.isFinite(minutes) && minutes > 0 ? `Renfo · ≈ ${Math.round(minutes)} min` : 'Renfo',
      legende: effortRenfo(r.rpe),
      lien: `/renfo/session/${r.id}`,
    })
  }

  // Plusieurs séances le même jour : la plus récente en haut, comme la frise (`tri` :
  // horodatage de completed_at, vide pour une séance sautée).
  for (const liste of parJour.values()) liste.sort((a, b) => (a.tri < b.tri ? 1 : a.tri > b.tri ? -1 : 0))

  const courses = new Map()
  const debuts = new Map()
  for (const p of plans) {
    const course = p.race_date?.slice(0, 10)
    if (course && course <= aujourdhui) {
      const distance = raceDistanceLabel(p.race_distance_m)
      const temps = p.race_time_sec ? formatGoalTime(p.race_time_sec) : null
      ajouter(courses, course, {
        type: 'course',
        titre: cleanText(p.race_name),
        chiffres: [distance, temps].filter(Boolean).join(' · ') || null,
        legende: p.goal_time_sec ? `Course · objectif ${formatGoalTime(p.goal_time_sec)}` : 'Course',
      })
    }
    const debut = p.start_date?.slice(0, 10)
    if (debut && debut <= aujourdhui) ajouter(debuts, debut, `Début de ${cleanText(p.race_name)}`)
  }

  // Seules les séances faites comptent : des séances sautées seules laissent la page vide.
  if ([...parMois.values()].every((t) => t.seances === 0)) return { vide: true, elements: [] }

  // Du jour d'aujourd'hui au plus ancien jour connu (séances et débuts de plan).
  const jours = [...parJour.keys(), ...debuts.keys()]
  const plusAncien = jours.reduce((min, iso) => (iso < min ? iso : min), aujourdhui)

  const elements = []
  let moisCourant = null
  for (let iso = aujourdhui; iso >= plusAncien; iso = addDaysISO(iso, -1)) {
    const mois = iso.slice(0, 7)
    if (mois !== moisCourant) {
      elements.push({ type: 'mois', cle: `mois-${mois}`, titre: libelleMoisFrise(mois, aujourdhui), total: totalMois(parMois.get(mois) ?? { metres: 0, seances: 0 }) })
      moisCourant = mois
    } else if (jourSemaine(iso) === 6) {
      // Entre ce dimanche et le lundi d'au-dessus, s'ils tombent dans un même plan.
      const plan = planDuJour(plans, iso)
      if (plan && plan === planDuJour(plans, addDaysISO(iso, 1))) elements.push({ type: 'filet', cle: `filet-${iso}` })
    }

    const auj = iso === aujourdhui
    const lignes = [...(courses.get(iso) ?? []), ...(parJour.get(iso) ?? [])]
    if (lignes.length === 0) {
      elements.push({ type: 'repos', cle: `repos-${iso}`, date: libelleJour(iso), aujourdhui: auj })
    } else {
      lignes.forEach((ligne, i) => {
        elements.push({ ...ligne, cle: `${ligne.type}-${iso}-${i}`, date: i === 0 ? libelleJour(iso) : null, aujourdhui: auj })
      })
    }
    for (const texte of debuts.get(iso) ?? []) elements.push({ type: 'debut', cle: `debut-${iso}-${texte}`, texte })
  }

  elements.forEach((e, i) => {
    if (e.type === 'mois') return
    const suivant = elements[i + 1]
    e.finRail = !suivant || suivant.type === 'mois'
  })

  return { vide: false, elements }
}
