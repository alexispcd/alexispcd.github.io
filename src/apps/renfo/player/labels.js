// Textes du player Renfo dérivés des steps du séquenceur. Module pur, sans React.
// Testé par labels.test.js.

import { formatClock } from '../dates.js'

/** Dosage d'un step de travail : « 12 rép. », « 0:45 », avec « par côté » si unilatéral. */
export const stepDoseText = (step) => {
  const value = step.advance === 'auto' ? formatClock(step.duration_sec) : `${step.reps} rép.`
  return step.side ? `${value} par côté` : value
}

/**
 * Position à droite de la progression : « Tour 2 / 4 » (superset), « Série 2 / 3 »
 * (bloc principal), « fin du tour 1 / 4 » pendant une récupération entre deux tours,
 * « fin de la série 1 / 3 » entre deux séries ; rien ailleurs.
 */
export const positionDroite = (step) => {
  if (!step) return ''
  if (step.kind === 'rest') {
    if (step.restType === 'round') return `fin du tour ${step.round} / ${step.roundCount}`
    if (step.restType === 'set' || step.restType === 'exercise') return `fin de la série ${step.set} / ${step.setCount}`
    if (step.restType === 'transition' && step.round) return `Tour ${step.round} / ${step.roundCount}`
    return ''
  }
  if (step.kind !== 'work') return ''
  if (step.round) return `Tour ${step.round} / ${step.roundCount}`
  if (step.set) return `Série ${step.set} / ${step.setCount}`
  return ''
}

/** Côté d'un exercice unilatéral : { cote: 'Gauche', rang: '1 / 2' }, ou null. */
export const libelleCote = (side) => {
  if (side === 'gauche') return { cote: 'Gauche', rang: '1 / 2' }
  if (side === 'droite') return { cote: 'Droite', rang: '2 / 2' }
  return null
}

/** Surtitre de la carte « Ensuite » : « Ensuite · côté gauche » pour un unilatéral. */
export const ensuiteLibelle = (step) => {
  if (step?.side === 'gauche') return 'Ensuite · côté gauche'
  if (step?.side === 'droite') return 'Ensuite · côté droit'
  return 'Ensuite'
}

/** Titre d'une pause. */
export const pauseTitle = (step) => {
  if (step.kind === 'prep') return 'Préparation'
  return step.restType === 'transition' ? 'Transition' : 'Récupération'
}

/** Contexte d'une pause : « fin du tour 1 », « fin de la série 2 », « bloc suivant ». */
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

/** Repos réglable par -15 s et +15 s : une récupération, jamais une transition ni la préparation. */
export const estRecuperation = (step) => step?.kind === 'rest' && step.restType !== 'transition'
