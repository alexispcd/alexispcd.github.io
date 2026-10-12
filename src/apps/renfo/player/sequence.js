// Séquenceur du player Renfo : transforme le contenu d'une séance
// (strength_sessions.content, schéma de _shared/strength/rules.ts) en une liste
// linéaire de steps prêts à dérouler en temps réel. Module pur, sans React.
//
// - Sas de préparation en tête.
// - Échauffement et retour au calme : chaque exercice une fois, TRANSITION_SEC
//   entre deux exercices.
// - Bloc principal : `sets` séries par exercice, `rest_sec` entre les séries et
//   avant l'exercice suivant.
// - Superset (A, B) ou triset (A, B, C) : `rounds` fois les membres dans l'ordre,
//   TRANSITION_SEC entre deux membres, puis `rest_sec` après le dernier membre sauf
//   après le dernier tour.
// - BETWEEN_BLOCKS_SEC entre deux blocs.
// - Un exercice unilatéral produit deux steps (gauche puis droite) sans repos.
// - Mode duration : décompte automatique ; mode reps : avancée manuelle.
// - Aucun repos après le dernier step.

import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { BETWEEN_BLOCKS_SEC, TRANSITION_SEC } from '../../../../supabase/functions/_shared/strength/estimate.ts'
import { blockLabel, supersetMembers } from '../content.js'

/** Sas de mise en place avant le premier exercice. */
export const PREP_SEC = 10

const SIDES = ['gauche', 'droite']

/** Durée estimée d'un step (s). Le sas de préparation n'est pas compté. */
export const stepSeconds = (step) => {
  if (step.kind === 'prep') return 0
  if (step.kind === 'rest' || step.advance === 'auto') return step.duration_sec ?? 0
  return (step.reps ?? 0) * (step.exercise?.sec_per_rep ?? 0)
}

/**
 * Construit la séquence du player.
 * @param {{ blocks: Array }} content contenu de la séance
 * @returns {{ steps: Array, totalSeconds: number }} totalSeconds hors préparation,
 *   cohérent avec estimateSessionMinutes.
 */
export const buildSequence = (content) => {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const steps = []

  // Repos en attente : matérialisé seulement si un step de travail le suit, ce qui
  // garantit qu'aucun repos ne traîne en fin de séance.
  let pending = null
  const rest = (sec, restType, meta) => (sec > 0 ? { kind: 'rest', advance: 'auto', duration_sec: sec, restType, ...meta } : null)
  const emit = (work) => {
    if (pending && steps.length) steps.push(pending)
    pending = null
    steps.push(...work)
  }

  // Steps de travail d'un exercice (un ou deux côtés).
  const workSteps = (dose, meta) => {
    const exercise = EXERCISE_INDEX[dose.slug] ?? null
    const base = dose.duration_sec != null
      ? { advance: 'auto', duration_sec: dose.duration_sec }
      : { advance: 'manual', reps: dose.reps ?? 0 }
    const common = {
      kind: 'work', ...base, slug: dose.slug, exercise,
      band_kg: dose.band_kg ?? null, anchor: exercise?.anchor ?? null,
      side: null, role: null, roles: null, round: null, roundCount: null, set: null, setCount: null,
      ...meta,
    }
    return exercise?.unilateral ? SIDES.map((side) => ({ ...common, side })) : [common]
  }

  blocks.forEach((block, blockIndex) => {
    const meta = { blockIndex, blockType: block.type, blockLabel: blockLabel(block, blockIndex, blocks) }
    if (blockIndex > 0 && steps.length) pending = rest(BETWEEN_BLOCKS_SEC, 'block', meta)

    if (block.type === 'warmup' || block.type === 'cooldown') {
      const items = block.items ?? []
      items.forEach((dose, i) => {
        emit(workSteps(dose, meta))
        if (i < items.length - 1) pending = rest(TRANSITION_SEC, 'transition', meta)
      })
    } else if (block.type === 'main') {
      for (const item of block.items ?? []) {
        const setCount = Math.max(1, item.sets ?? 1)
        for (let set = 1; set <= setCount; set++) {
          emit(workSteps(item, { ...meta, set, setCount }))
          // Entre deux séries, puis avant l'exercice suivant : rest_sec.
          pending = rest(item.rest_sec ?? 0, set < setCount ? 'set' : 'exercise', { ...meta, set, setCount })
        }
      }
    } else if (block.type === 'superset') {
      const members = supersetMembers(block)
      const roles = members.map((m) => m.role)
      const roundCount = Math.max(1, block.rounds ?? 1)
      for (let round = 1; round <= roundCount; round++) {
        const roundMeta = { ...meta, round, roundCount }
        members.forEach(({ dose, role }, i) => {
          if (i > 0) pending = rest(TRANSITION_SEC, 'transition', roundMeta)
          emit(workSteps(dose, { ...roundMeta, role, roles }))
        })
        if (round < roundCount) pending = rest(block.rest_sec ?? 0, 'round', roundMeta)
      }
    }
  })

  if (steps.length) {
    steps.unshift({ kind: 'prep', advance: 'auto', duration_sec: PREP_SEC, blockIndex: null, blockLabel: null })
  }
  steps.forEach((step, i) => { step.index = i })
  const totalSeconds = steps.reduce((sum, step) => sum + stepSeconds(step), 0)
  return { steps, totalSeconds }
}

/** Prochain step de travail après l'index donné (aperçu pendant un repos). */
export const nextWorkStep = (steps, index) => steps.slice(index + 1).find((s) => s.kind === 'work') ?? null

/** Dernière hauteur de barre utilisée jusqu'à l'index donné inclus, ou null. */
export const lastAnchorBefore = (steps, index) => {
  for (let i = index; i >= 0; i--) {
    const s = steps[i]
    if (s?.kind === 'work' && s.anchor && s.exercise?.equipment.includes('bar')) return s.anchor
  }
  return null
}

/** Second côté d'un exercice unilatéral : même exercice, juste après le premier côté. */
const isSecondSide = (steps, i) =>
  steps[i]?.side === SIDES[1] && steps[i - 1]?.kind === 'work' && steps[i - 1].slug === steps[i].slug

/**
 * Les `n` prochains steps de travail après l'index, chacun avec le repos qui le
 * précède (`rest`, step de repos ou null). Le second côté d'un unilatéral n'est pas
 * compté : il suit son premier côté sans repos et porte le même exercice.
 * @returns {Array<{ step, rest }>}
 */
export const upcomingWork = (steps, index, n) => {
  const out = []
  for (let i = index + 1; i < steps.length && out.length < n; i++) {
    const step = steps[i]
    if (step.kind !== 'work' || isSecondSide(steps, i)) continue
    const before = steps[i - 1]
    out.push({ step, rest: i - 1 > index && before?.kind === 'rest' ? before : null })
  }
  return out
}

/**
 * Avancement par bloc : un segment par bloc de la séance, dans l'ordre, avec son
 * libellé, son poids (somme des stepSeconds de ses steps, repos d'entrée compris) et
 * la fraction faite (steps d'index strictement inférieur à `index`).
 * @returns {Array<{ blockIndex, label, weight, done }>}
 */
export const blockProgress = (steps, index) => {
  const segments = new Map()
  for (const step of steps) {
    if (step.blockIndex == null) continue
    let seg = segments.get(step.blockIndex)
    if (!seg) {
      seg = { blockIndex: step.blockIndex, label: step.blockLabel, weight: 0, doneWeight: 0, count: 0, doneCount: 0 }
      segments.set(step.blockIndex, seg)
    }
    const sec = stepSeconds(step)
    seg.weight += sec
    seg.count += 1
    if (step.index < index) {
      seg.doneWeight += sec
      seg.doneCount += 1
    }
  }
  return [...segments.values()].map(({ blockIndex, label, weight, doneWeight, count, doneCount }) => ({
    blockIndex,
    label,
    weight,
    // Bloc sans durée estimable : avancement au nombre de steps.
    done: weight > 0 ? doneWeight / weight : count ? doneCount / count : 0,
  }))
}
