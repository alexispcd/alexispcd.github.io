// Tests des textes du player Renfo (node:test, sans dépendance).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSequence } from './sequence.js'
import { ensuiteLibelle, estRecuperation, libelleCote, pauseContext, pauseTitle, positionDroite, stepDoseText } from './labels.js'

const CONTENT = {
  blocks: [
    { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }, { slug: 'dead_bug', reps: 10 }] },
    { type: 'superset', focus: 'legs', rounds: 4, rest_sec: 90, exercises: [
      { slug: 'squat_bulgare', reps: 12 },
      { slug: 'planche', duration_sec: 50 },
    ] },
    { type: 'main', items: [{ slug: 'pompes', sets: 3, reps: 10, rest_sec: 60 }] },
    { type: 'cooldown', items: [{ slug: 'posture_enfant', duration_sec: 45 }] },
  ],
}
const { steps } = buildSequence(CONTENT)
const find = (fn) => steps.find(fn)

test('position de droite : tour, série, fin du tour, rien hors superset', () => {
  assert.equal(positionDroite(find((s) => s.slug === 'squat_bulgare' && s.round === 2)), 'Tour 2 / 4')
  assert.equal(positionDroite(find((s) => s.restType === 'round' && s.round === 1)), 'fin du tour 1 / 4')
  assert.equal(positionDroite(find((s) => s.restType === 'transition' && s.blockIndex === 1 && s.round === 3)), 'Tour 3 / 4')
  assert.equal(positionDroite(find((s) => s.slug === 'pompes' && s.set === 2)), 'Série 2 / 3')
  assert.equal(positionDroite(find((s) => s.restType === 'set' && s.set === 1)), 'fin de la série 1 / 3')
  assert.equal(positionDroite(find((s) => s.slug === 'cercles_hanche')), '')
  assert.equal(positionDroite(steps[0]), '')
  assert.equal(positionDroite(find((s) => s.restType === 'block')), '')
  assert.equal(positionDroite(null), '')
})

test('côté : « Gauche · 1 / 2 », « Droite · 2 / 2 », rien sur les deux côtés', () => {
  assert.deepEqual(libelleCote('gauche'), { cote: 'Gauche', rang: '1 / 2' })
  assert.deepEqual(libelleCote('droite'), { cote: 'Droite', rang: '2 / 2' })
  assert.equal(libelleCote(null), null)
})

test('dose et carte Ensuite', () => {
  const squat = find((s) => s.slug === 'squat_bulgare')
  assert.equal(stepDoseText(squat), '12 rép. par côté')
  assert.equal(stepDoseText(find((s) => s.slug === 'planche')), '0:50')
  assert.equal(ensuiteLibelle(squat), 'Ensuite · côté gauche')
  assert.equal(ensuiteLibelle(find((s) => s.slug === 'planche')), 'Ensuite')
})

test('pauses : titre, contexte, récupération réglable', () => {
  assert.equal(pauseTitle(steps[0]), 'Préparation')
  assert.equal(pauseContext(steps[0]), 'mets-toi en place')
  const round = find((s) => s.restType === 'round')
  assert.equal(pauseTitle(round), 'Récupération')
  assert.equal(pauseContext(round), 'fin du tour 1')
  const transition = find((s) => s.restType === 'transition')
  assert.equal(pauseTitle(transition), 'Transition')
  assert.equal(pauseContext(transition), 'enchaîne')
  assert.equal(estRecuperation(round), true)
  assert.equal(estRecuperation(find((s) => s.restType === 'block')), true)
  assert.equal(estRecuperation(transition), false)
  assert.equal(estRecuperation(steps[0]), false)
})
