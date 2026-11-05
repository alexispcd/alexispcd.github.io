// Position d'une séance Renfo dans le player, gardée sur le téléphone (localStorage)
// pour reprendre là où l'on s'est arrêté. Module pur, sans React, testé par
// position.test.js. Chaque accès au stockage est protégé : stockage absent, plein ou
// bloqué, on fait sans (la séance repart du début).
//
// Clé cairn-renfo-position-<sessionId>, valeur { signature, cursor, elapsedSec, fin } :
// - signature : les étapes à la suite (kind, slug, side). Une dose ajustée ne la
//   change pas ; un exercice remplacé ou un superset changé si, et la position tombe.
// - cursor : index de l'étape en cours ; elapsedSec : temps passé dans le player ;
// - fin : séance finie dans le player, pas encore validée.

import { focusStep } from './sequence.js'

const cle = (sessionId) => `cairn-renfo-position-${sessionId}`

/** Signature des étapes : « kind:slug:side » à la suite, séparées par « | ». */
export const signatureEtapes = (steps) =>
  (steps ?? []).map((s) => `${s.kind}:${s.slug ?? ''}:${s.side ?? ''}`).join('|')

/**
 * Position gardée de la séance, ou null : absente, illisible, signature différente
 * (la clé est alors effacée) ou cursor hors des étapes.
 * @returns {{ cursor: number, elapsedSec: number, fin: boolean } | null}
 */
export const lirePosition = (sessionId, steps) => {
  let valeur
  try {
    const brut = localStorage.getItem(cle(sessionId))
    if (!brut) return null
    valeur = JSON.parse(brut)
  } catch {
    return null
  }
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return null
  if (valeur.signature !== signatureEtapes(steps)) {
    effacerPosition(sessionId)
    return null
  }
  const { cursor, elapsedSec, fin } = valeur
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= (steps?.length ?? 0)) return null
  if (typeof elapsedSec !== 'number' || !Number.isFinite(elapsedSec) || elapsedSec < 0) return null
  return { cursor, elapsedSec, fin: fin === true }
}

/** Garde la position de la séance. */
export const ecrirePosition = (sessionId, steps, { cursor, elapsedSec, fin = false }) => {
  try {
    localStorage.setItem(cle(sessionId), JSON.stringify({
      signature: signatureEtapes(steps),
      cursor,
      elapsedSec: Math.max(0, Math.round(elapsedSec ?? 0)),
      fin: Boolean(fin),
    }))
  } catch {
    // Stockage indisponible : la séance repartira du début.
  }
}

/** Efface la position : validation, réinitialisation, suppression, Recommencer. */
export const effacerPosition = (sessionId) => {
  try {
    localStorage.removeItem(cle(sessionId))
  } catch {
    // Rien à effacer.
  }
}

/**
 * Où la séance s'est arrêtée : « Arrêtée au superset 2 · tour 2 / 4 », « Arrêtée à
 * l'échauffement », « Arrêtée au retour au calme », « Arrêtée au superset 2 » sans
 * tour. Pendant une pause, c'est le bloc de l'exercice suivant.
 */
export const arretLibelle = (steps, cursor) => {
  const focus = focusStep(steps, cursor)
  if (!focus) return ''
  switch (focus.blockType) {
    case 'warmup': return 'Arrêtée à l\'échauffement'
    case 'cooldown': return 'Arrêtée au retour au calme'
    case 'main': return focus.set ? `Arrêtée au bloc principal · série ${focus.set} / ${focus.setCount}` : 'Arrêtée au bloc principal'
    default: {
      const tour = focus.round ? ` · tour ${focus.round} / ${focus.roundCount}` : ''
      return `Arrêtée au superset ${focus.rang}${tour}`
    }
  }
}

/**
 * État de chaque bloc de la séance, par index de bloc : « Fait » pour les blocs
 * passés (tous en fin de séance), « Tour 2 / 4 » pour le superset en cours, null sinon.
 */
export const etatBlocs = (steps, cursor, fin = false) => {
  const nb = (steps ?? []).reduce((max, s) => (s.blockIndex == null ? max : Math.max(max, s.blockIndex + 1)), 0)
  const focus = fin ? null : focusStep(steps, cursor)
  return Array.from({ length: nb }, (_, i) => {
    if (!focus || i < focus.blockIndex) return 'Fait'
    if (i === focus.blockIndex && focus.round) return `Tour ${focus.round} / ${focus.roundCount}`
    return null
  })
}
