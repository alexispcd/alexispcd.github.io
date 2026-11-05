// Textes de la page séance Renfo, de sa fiche et de Remplacer, sans React.
// Testé par seance.test.js.

import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import {
  GROUP_LABELS, groupOfFocus, TRISET_FOCUS_LABELS,
} from '../../../../supabase/functions/_shared/strength/rules.ts'
import { formatShortDay } from '../../../lib/dates.js'
import { jourLocal, libelleSupersets } from '../accueil.js'
import { formatKg } from '../bandColor.js'
import { ANCHOR_LABELS, bandOf, doseLabel, mainDoseLabel, supersetMembers, supersetRank, titreAffiche } from '../content.js'

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

const blocsDe = (content) => (Array.isArray(content?.blocks) ? content.blocks : [])

const supersetsDe = (content) => blocsDe(content).filter((b) => b.type === 'superset')

/** Jour de la séance faite : « sam 24 oct », ou chaîne vide. */
export const jourFaite = (session) => formatShortDay(jourLocal(session?.completed_at))

/** Thèmes de la séance, sans doublon, dans l'ordre : « Jambes, Haut du corps, Tronc ». */
export const themesSeance = (content) => [
  ...new Set(supersetsDe(content).map((b) => TRISET_FOCUS_LABELS[b.focus]).filter(Boolean)),
].join(', ')

/** Ligne sous le titre : « ≈ 63 min · 3 supersets », précédée de « Faite sam 24 oct » une fois faite. */
export const ligneEnTete = (session) => {
  const parts = []
  const jour = session?.status === 'done' ? jourFaite(session) : ''
  if (jour) parts.push(`Faite ${jour}`)
  const minutes = session?.content?.estimated_min
  if (minutes != null) parts.push(`≈ ${minutes} min`)
  const n = supersetsDe(session?.content).length
  if (n) parts.push(libelleSupersets(n))
  return parts.join(' · ')
}

/** Rang d'un superset parmi ceux de la séance (1, 2, 3), ou null pour un autre bloc. */
export const rangSuperset = (content, blockIndex) => supersetRank(blockIndex, blocsDe(content))

/** Exercices d'un bloc dans l'ordre de jeu. */
export const exercicesDuBloc = (block) =>
  (block?.type === 'superset' ? supersetMembers(block) : block?.items ?? [])

const nomDe = (slug) => EXERCISE_INDEX[slug]?.name ?? slug

/** Titre d'un bloc : « Échauffement », le thème d'un superset (« Tirage »), « Bloc principal ». */
export const titreBloc = (block) => {
  if (block?.type === 'warmup') return 'Échauffement'
  if (block?.type === 'cooldown') return 'Retour au calme'
  if (block?.type === 'main') return 'Bloc principal'
  return TRISET_FOCUS_LABELS[block?.focus] ?? 'Superset'
}

/**
 * Ligne d'un bloc : « 3 exercices · 3 tours · repos 60 s » pour un superset, sinon
 * la liste des noms (« Cercles de hanche, Balancements de jambe »).
 */
export const ligneBloc = (block) => {
  if (block?.type === 'superset') {
    const n = supersetMembers(block).length
    return `${pluriel(n, 'exercice')} · ${pluriel(block.rounds, 'tour')} · repos ${block.rest_sec} s`
  }
  return exercicesDuBloc(block).map((d) => nomDe(d.slug)).join(', ')
}

/** Dose d'une ligne d'exercice : « 12 rép. par côté », ou « 4 × 8 · repos 90 s » dans un bloc principal. */
export const doseDeLigne = (dose, block) => (block?.type === 'main' ? mainDoseLabel(dose) : doseLabel(dose))

/** Ligne de dose de la fiche : « 10 rép. · élastique 15 kg » (élastique joué s'il y en a un). */
export const ligneDose = (dose, bandsUsed, block) => {
  const kg = bandOf(dose, bandsUsed)
  const base = doseDeLigne(dose, block)
  return kg == null ? base : `${base} · élastique ${formatKg(kg)} kg`
}

/** « prévu 15 kg » quand la bande jouée diffère de la bande prévue, sinon null. */
export const prevu = (dose, bandsUsed) => {
  const joue = bandsUsed?.[dose.slug]
  if (joue == null || dose.band_kg == null || Number(joue) === Number(dose.band_kg)) return null
  return `prévu ${formatKg(dose.band_kg)} kg`
}

/**
 * Pastilles d'un exercice : hauteur de barre et chaise en matériel, puis la bande
 * (kg, ou « Élastique » générique avec `bandeGenerique`).
 * Renvoie [{ variante: 'materiel', libelle }] ou [{ variante: 'bande', kg }].
 */
export const pastillesExercice = (slug, { kg = null, bandeGenerique = false } = {}) => {
  const ex = EXERCISE_INDEX[slug]
  if (!ex) return []
  const out = []
  if (ex.equipment.includes('bar') && ex.anchor) out.push({ variante: 'materiel', libelle: ANCHOR_LABELS[ex.anchor] })
  if (ex.equipment.includes('chair')) out.push({ variante: 'materiel', libelle: 'Chaise' })
  if (ex.equipment.includes('band')) {
    if (bandeGenerique) out.push({ variante: 'materiel', libelle: 'Élastique' })
    else if (kg != null) out.push({ variante: 'bande', kg: Number(kg) })
  }
  return out
}

// Ce que proposent les remplaçants, par catégorie de l'exercice remplacé.
const TERMES = {
  warmup: "d'échauffement",
  cooldown: 'de retour au calme',
  legs: 'de jambes',
  posterior_chain: "d'ischios et fessiers",
  calves_feet: 'de mollets et pieds',
  pull: 'de tirage',
  push: 'de poussée',
  arms: 'de bras',
  core: 'de tronc',
  balance: "d'équilibre",
}

/** Titre de Remplacer : « Remplacer Tractions assistées ». */
export const titreRemplacer = (slug) => `Remplacer ${nomDe(slug)}`

/**
 * Sous-ligne de Remplacer : « Superset 2 · Haut du corps · exercices de tirage avec
 * ton matériel », « Échauffement · exercices d'échauffement avec ton matériel ».
 */
export const sousLigneRemplacer = (content, blockIndex, slug) => {
  const block = blocsDe(content)[blockIndex]
  const terme = TERMES[EXERCISE_INDEX[slug]?.category]
  const fin = terme ? `exercices ${terme} avec ton matériel` : 'exercices avec ton matériel'
  if (block?.type === 'superset') {
    const groupe = GROUP_LABELS[groupOfFocus(block.focus)]
    return [`Superset ${rangSuperset(content, blockIndex)}`, groupe, fin].filter(Boolean).join(' · ')
  }
  return `${titreBloc(block)} · ${fin}`
}

/** Titre de la confirmation de suppression, à faire ou faite. */
export const phraseSuppression = (session) => {
  const titre = titreAffiche(session?.title)
  if (session?.status === 'done') {
    const jour = jourFaite(session)
    return `${titre}${jour ? `, faite ${jour},` : ''} disparaîtra de ton Historique des séances et de ta semaine.`
  }
  return `${titre} sera supprimée. Tu pourras en créer une autre depuis l'accueil.`
}

/** Titre de la confirmation de réinitialisation. */
export const phraseReinitialisation = (session) =>
  `${titreAffiche(session?.title)} repassera à faire. Ton ressenti sera effacé, les élastiques joués sont gardés.`
