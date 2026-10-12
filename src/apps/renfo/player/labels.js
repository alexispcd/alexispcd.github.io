// Textes du player Renfo dérivés des steps du séquenceur. Module pur, sans React.

import { formatClock } from '../dates.js'

/** Dosage d'un step de travail : "12 reps", "0:45", avec "par côté" si unilatéral. */
export const stepDoseText = (step) => {
  const value = step.advance === 'auto' ? formatClock(step.duration_sec) : `${step.reps} reps`
  return step.side ? `${value} par côté` : value
}

/** Position du step dans son bloc : "Tour 2 / 3", "Série 2 / 3", ou null. */
export const stepPosition = (step) => {
  if (step.round) return `Tour ${step.round} / ${step.roundCount}`
  if (step.set) return `Série ${step.set} / ${step.setCount}`
  return null
}

/** Titre d'une pause. */
export const pauseTitle = (step) => {
  if (step.kind === 'prep') return 'Préparation'
  return step.restType === 'transition' ? 'Transition' : 'Récupération'
}

/** Contexte d'une pause : "fin du tour 1", "fin de la série 2", "bloc suivant". */
export const pauseContext = (step) => {
  if (step.kind === 'prep') return 'mets-toi en place'
  switch (step.restType) {
    case 'round': return `fin du tour ${step.round}`
    case 'set': return `fin de la série ${step.set}`
    case 'exercise': return 'exercice suivant'
    case 'block': return 'bloc suivant'
    default: return 'enchaîne'
  }
}

/** "Côté gauche", "Côté droit" (le séquenceur produit gauche et droite). */
export const sideLabel = (side) => `Côté ${side === 'droite' ? 'droit' : side}`
