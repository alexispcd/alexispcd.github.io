// Tests de la position gardée du player Renfo (node:test, sans dépendance).

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { buildSequence } from './sequence.js'
import { arretLibelle, ecrirePosition, effacerPosition, etatBlocs, lirePosition, signatureEtapes } from './position.js'

// Stockage en mémoire à la place de localStorage.
const memoire = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
    setItem: (k, v) => { memoire.set(k, String(v)) },
    removeItem: (k) => { memoire.delete(k) },
  },
})
beforeEach(() => memoire.clear())

const CONTENT = {
  blocks: [
    { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }] },
    { type: 'superset', focus: 'legs', rounds: 2, rest_sec: 90, exercises: [
      { slug: 'squat_bulgare', reps: 12 }, { slug: 'pompes', reps: 10 },
    ] },
    { type: 'superset', focus: 'upper', rounds: 4, rest_sec: 60, exercises: [
      { slug: 'tractions_assistees', reps: 8, band_kg: 15 }, { slug: 'planche', duration_sec: 40 },
    ] },
    { type: 'cooldown', items: [{ slug: 'posture_enfant', duration_sec: 45 }] },
  ],
}
const { steps } = buildSequence(CONTENT)
const ID = 'seance-1'
const CLE = `cairn-renfo-position-${ID}`
const index = (fn) => steps.findIndex(fn)

test('signature : une dose changée ne la change pas, un exercice remplacé ou un tour de plus si', () => {
  const sig = signatureEtapes(steps)
  const dose = structuredClone(CONTENT)
  dose.blocks[1].exercises[0].reps = 15
  dose.blocks[2].exercises[1].duration_sec = 60
  assert.equal(signatureEtapes(buildSequence(dose).steps), sig)
  const remplace = structuredClone(CONTENT)
  remplace.blocks[1].exercises[1] = { slug: 'dead_bug', reps: 10 }
  assert.notEqual(signatureEtapes(buildSequence(remplace).steps), sig)
  const tours = structuredClone(CONTENT)
  tours.blocks[1].rounds = 3
  assert.notEqual(signatureEtapes(buildSequence(tours).steps), sig)
})

test('écrire puis lire', () => {
  ecrirePosition(ID, steps, { cursor: 5, elapsedSec: 312.4 })
  assert.deepEqual(lirePosition(ID, steps), { cursor: 5, elapsedSec: 312, fin: false })
  ecrirePosition(ID, steps, { cursor: steps.length - 1, elapsedSec: 1800, fin: true })
  assert.deepEqual(lirePosition(ID, steps), { cursor: steps.length - 1, elapsedSec: 1800, fin: true })
  effacerPosition(ID)
  assert.equal(lirePosition(ID, steps), null)
})

test('lire : absente, illisible, hors limites', () => {
  assert.equal(lirePosition(ID, steps), null)
  memoire.set(CLE, '{pas du json')
  assert.equal(lirePosition(ID, steps), null)
  memoire.set(CLE, JSON.stringify([1, 2]))
  assert.equal(lirePosition(ID, steps), null)
  ecrirePosition(ID, steps, { cursor: steps.length, elapsedSec: 10 })
  assert.equal(lirePosition(ID, steps), null)
  ecrirePosition(ID, steps, { cursor: -1, elapsedSec: 10 })
  assert.equal(lirePosition(ID, steps), null)
})

test('lire : signature différente, la clé est effacée', () => {
  ecrirePosition(ID, steps, { cursor: 3, elapsedSec: 60 })
  const autre = structuredClone(CONTENT)
  autre.blocks[2].exercises[0] = { slug: 'pompes', reps: 10 }
  assert.equal(lirePosition(ID, buildSequence(autre).steps), null)
  assert.equal(memoire.has(CLE), false)
})

test('stockage indisponible : rien ne lève', () => {
  const garde = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => { throw new Error('bloqué') },
  })
  try {
    assert.doesNotThrow(() => ecrirePosition(ID, steps, { cursor: 2, elapsedSec: 1 }))
    assert.equal(lirePosition(ID, steps), null)
    assert.doesNotThrow(() => effacerPosition(ID))
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: garde })
  }
})

test('arrêt : superset et tour, échauffement, retour au calme, bloc suivant pendant une pause', () => {
  assert.equal(arretLibelle(steps, index((s) => s.slug === 'cercles_hanche')), 'Arrêtée à l\'échauffement')
  assert.equal(arretLibelle(steps, index((s) => s.slug === 'pompes' && s.round === 2)), 'Arrêtée au superset 1 · tour 2 / 2')
  // Récupération après le tour 1 du superset 2 : l'exercice suivant est au tour 2.
  assert.equal(arretLibelle(steps, index((s) => s.restType === 'round' && s.blockIndex === 2)), 'Arrêtée au superset 2 · tour 2 / 4')
  // Repos entre deux blocs : le bloc qui suit.
  assert.equal(arretLibelle(steps, index((s) => s.restType === 'block' && s.blockIndex === 2)), 'Arrêtée au superset 2 · tour 1 / 4')
  assert.equal(arretLibelle(steps, index((s) => s.slug === 'posture_enfant')), 'Arrêtée au retour au calme')
  const sansTour = { blocks: [{ type: 'superset', rounds: 1, rest_sec: 60, a: { slug: 'pompes', reps: 10 }, b: { slug: 'dead_bug', reps: 10 } }] }
  const st = buildSequence(sansTour).steps
  assert.equal(arretLibelle(st, 1), 'Arrêtée au superset 1 · tour 1 / 1')
  assert.equal(arretLibelle(st, st.length), '')
})

test('états des blocs : Fait, Tour, rien ; tout Fait en fin de séance', () => {
  const i = index((s) => s.slug === 'tractions_assistees' && s.round === 2)
  assert.deepEqual(etatBlocs(steps, i), ['Fait', 'Fait', 'Tour 2 / 4', null])
  assert.deepEqual(etatBlocs(steps, index((s) => s.slug === 'cercles_hanche')), [null, null, null, null])
  assert.deepEqual(etatBlocs(steps, index((s) => s.slug === 'posture_enfant')), ['Fait', 'Fait', 'Fait', null])
  assert.deepEqual(etatBlocs(steps, steps.length - 1, true), ['Fait', 'Fait', 'Fait', 'Fait'])
})
