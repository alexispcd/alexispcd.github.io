// Séquenceur du player renfo : transforme les blocs affichés (content.blocks,
// ceux de la durée sélectionnée — PAS base_blocks) en une liste LINÉAIRE de
// steps prêts à dérouler en temps réel.
//
// Module pur, sans dépendance React, testable isolément.
//
// La séquence s'ouvre sur un step 'prep' (sas de mise en place). Ensuite, chaque
// série d'un exercice produit : un (ou deux, si duration unilatéral) step de
// travail, suivi d'un step de repos de `rest_sec`. Le tout dernier repos de la
// séance est omis (rien à récupérer après la dernière série).

// Miroir de renfo.js / strength.ts : coût estimé d'une répétition en secondes.
// Sert à donner une durée à un step 'reps' (avancé manuellement) pour que la
// durée totale reste cohérente avec l'estimateur existant.
const PER_REP_SEC = 3

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

  // 1) Aplatir en "unités de série" : chaque série = ses steps de travail + le
  //    repos qui la suit (rest_sec). Le repos est matérialisé au flatten pour
  //    pouvoir omettre le dernier de la séance.
  const units = []
  for (const block of list) {
    const theme = block?.theme ?? block?.name ?? null
    const exos = Array.isArray(block?.exercises) ? block.exercises : []
    for (const ex of exos) {
      const exercise = {
        name: ex?.name ?? ex?.slug ?? 'Exercice',
        description: ex?.description ?? null,
        equipment: ex?.equipment ?? null,
      }
      const setCount = Math.max(1, ex?.sets ?? 1)
      const restSec = ex?.rest_sec ?? 0
      const isDuration = ex?.duration_sec != null

      for (let s = 0; s < setCount; s++) {
        const meta = { exercise, theme, setIndex: s + 1, setCount }
        const workSteps = []
        if (isDuration) {
          if (ex?.unilateral) {
            // Deux steps enchaînés (pas de repos entre les côtés).
            for (const side of SIDES) {
              workSteps.push({ kind: 'work', advance: 'auto', duration_sec: ex.duration_sec, side, ...meta })
            }
          } else {
            workSteps.push({ kind: 'work', advance: 'auto', duration_sec: ex.duration_sec, side: null, ...meta })
          }
        } else {
          workSteps.push({ kind: 'work', advance: 'manual', reps: ex?.reps ?? 0, side: null, ...meta })
        }
        units.push({ workSteps, restSec, meta })
      }
    }
  }

  // 2) Flatten : préparation + steps de travail + repos, sauf après la toute
  //    dernière série. Pas de préparation si la séance est vide.
  const steps = []
  if (units.length > 0) {
    steps.push({
      kind: 'prep', advance: 'auto', duration_sec: PREP_SEC,
      exercise: null, theme: null, setIndex: null, setCount: null, side: null,
    })
  }
  units.forEach((unit, i) => {
    for (const w of unit.workSteps) steps.push(w)
    const isLast = i === units.length - 1
    if (!isLast && unit.restSec > 0) {
      steps.push({ kind: 'rest', advance: 'auto', duration_sec: unit.restSec, side: null, ...unit.meta })
    }
  })

  // 3) Index global + durée totale.
  steps.forEach((step, i) => { step.index = i })
  const totalSeconds = steps.reduce((sum, step) => sum + stepSeconds(step), 0)

  return { steps, totalSeconds }
}
