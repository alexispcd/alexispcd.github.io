// Séquenceur du player renfo : transforme les blocs affichés (content.blocks,
// ceux de la durée sélectionnée — PAS base_blocks) en une liste LINÉAIRE de
// steps prêts à dérouler en temps réel.
//
// Module pur, sans dépendance React, testable isolément.
//
// La séquence s'ouvre sur un step 'prep' (sas de mise en place). Ensuite, chaque
// bloc est un CIRCUIT : ses exercices s'enchaînent, séparés par un repos de
// REST_BETWEEN_EXERCISES_SEC, et l'ensemble est répété `rounds` fois avec un
// repos de REST_BETWEEN_ROUNDS_SEC entre les tours et entre les blocs. Un
// exercice unilatéral produit deux steps de travail (gauche puis droite), sans
// repos entre les côtés. Aucun repos après le tout dernier step.
//
// Les blocs SANS `rounds` sont historiques (plans générés avant le format
// circuit) : ils conservent le déroulé en séries piloté par sets / rest_sec.

import { PER_REP_SEC, REST_BETWEEN_EXERCISES_SEC, REST_BETWEEN_ROUNDS_SEC } from '../renfo.js'

// Ordre des côtés pour un exercice unilatéral (gauche puis droite).
const SIDES = ['gauche', 'droite']

// Sas de mise en place en tête de séance : le temps de poser le téléphone et de
// se placer avant le premier exercice.
const PREP_SEC = 10

/**
 * Durée (s) d'un step : repos/duration = décompte ; reps = estimation.
 * Le sas de préparation est exclu pour que le total reste comparable à
 * l'estimateur de renfo.js, qui ne connaît que le travail et les repos.
 */
const stepSeconds = (step) => {
  if (step.kind === 'prep') return 0
  if (step.advance === 'auto') return step.duration_sec ?? 0
  return (step.reps ?? 0) * PER_REP_SEC
}

/** Métadonnées d'exercice exposées au player. */
const exerciseOf = (ex) => ({
  name: ex?.name ?? ex?.slug ?? 'Exercice',
  description: ex?.description ?? null,
  equipment: ex?.equipment ?? null,
})

/**
 * Steps de travail d'un exercice pour un passage.
 * `splitSides` : produire deux steps gauche/droite pour un exercice unilatéral.
 */
const workStepsFor = (ex, meta, splitSides) => {
  const base = ex?.duration_sec != null
    ? { kind: 'work', advance: 'auto', duration_sec: ex.duration_sec }
    : { kind: 'work', advance: 'manual', reps: ex?.reps ?? 0 }
  const common = { ...base, exercise: exerciseOf(ex), ...meta }
  return splitSides && ex?.unilateral
    ? SIDES.map((side) => ({ ...common, side }))
    : [{ ...common, side: null }]
}

/**
 * Construit la séquence linéaire du player.
 *
 * @param {Array} blocks content.blocks (durée sélectionnée)
 * @returns {{ steps: Array, totalSeconds: number }}
 *   steps : liste ordonnée, chaque step portant son `index` global.
 *   totalSeconds : durée totale estimée (travail + repos), cohérente avec
 *   l'estimateur de renfo.js (même coût par répétition).
 */
export const buildSequence = (blocks) => {
  const list = Array.isArray(blocks) ? blocks : []
  const steps = []

  // Repos en attente : il n'est matérialisé que si un step de travail le suit.
  // C'est ce qui garantit qu'aucun repos ne traîne en fin de séance ni de bloc
  // vide, sans avoir à nettoyer la séquence après coup.
  let pending = null
  const restStep = (sec, theme) => (sec > 0
    ? {
      kind: 'rest', advance: 'auto', duration_sec: sec, theme, side: null,
      exercise: null, roundIndex: null, roundCount: null, setIndex: null, setCount: null,
    }
    : null)
  const emit = (work) => {
    if (pending && steps.length) steps.push(pending)
    pending = null
    steps.push(...work)
  }

  list.forEach((block, bi) => {
    const exos = Array.isArray(block?.exercises) ? block.exercises : []
    if (!exos.length) return
    const theme = block?.theme ?? block?.name ?? null
    if (bi > 0) pending = restStep(REST_BETWEEN_ROUNDS_SEC, theme)

    // Bloc historique : une suite d'exercices faits en N séries chacun.
    if (block?.rounds == null) {
      for (const ex of exos) {
        const setCount = Math.max(1, ex?.sets ?? 1)
        for (let s = 1; s <= setCount; s++) {
          // Le doublage unilatéral ne portait que sur le mode duration.
          emit(workStepsFor(ex, { theme, setIndex: s, setCount }, ex?.duration_sec != null))
          pending = restStep(ex?.rest_sec ?? 0, theme)
        }
      }
      return
    }

    const roundCount = Math.max(1, block.rounds)
    for (let r = 1; r <= roundCount; r++) {
      exos.forEach((ex, ei) => {
        emit(workStepsFor(ex, { theme, roundIndex: r, roundCount }, true))
        if (ei < exos.length - 1) pending = restStep(REST_BETWEEN_EXERCISES_SEC, theme)
      })
      if (r < roundCount) pending = restStep(REST_BETWEEN_ROUNDS_SEC, theme)
    }
  })

  // Sas de préparation en tête, seulement si la séance a du contenu.
  if (steps.length > 0) {
    steps.unshift({
      kind: 'prep', advance: 'auto', duration_sec: PREP_SEC, exercise: null, theme: null,
      side: null, roundIndex: null, roundCount: null, setIndex: null, setCount: null,
    })
  }

  steps.forEach((step, i) => { step.index = i })
  const totalSeconds = steps.reduce((sum, step) => sum + stepSeconds(step), 0)

  return { steps, totalSeconds }
}
