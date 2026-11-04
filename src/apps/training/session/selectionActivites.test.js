// Tests de la sélection des activités de la page « Valider la séance » (node:test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ACTIVITES, selectionVide, apresRecherche, toucherActivite, toucherSans, activitesAEnvoyer,
} from './selectionActivites.js'

const candidats = [
  { labelId: 'a', startTimestamp: 300, sport_type: 100 },
  { labelId: 'b', startTimestamp: 100, sport_type: 102 },
  { labelId: 'c', startTimestamp: 200 },
  { labelId: 'd', startTimestamp: 400, sport_type: 100 },
]

test('apresRecherche : première activité cochée, sinon sans activité', () => {
  assert.deepEqual(apresRecherche(candidats), { ids: ['a'], sans: false })
  assert.deepEqual(apresRecherche([]), { ids: [], sans: true })
  assert.deepEqual(apresRecherche(null), { ids: [], sans: true })
})

test('toucherActivite : coche et retire sans activité', () => {
  assert.deepEqual(toucherActivite({ ids: [], sans: true }, 'b'), { ids: ['b'], sans: false })
  assert.deepEqual(toucherActivite({ ids: ['a'], sans: false }, 'b'), { ids: ['a', 'b'], sans: false })
})

test('toucherActivite : rien ne change au-delà de la borne', () => {
  assert.equal(MAX_ACTIVITES, 3)
  const pleine = { ids: ['a', 'b', 'c'], sans: false }
  assert.equal(toucherActivite(pleine, 'd'), pleine)
})

test('toucherActivite : décocher, la dernière coche sans activité', () => {
  assert.deepEqual(toucherActivite({ ids: ['a', 'b'], sans: false }, 'a'), { ids: ['b'], sans: false })
  assert.deepEqual(toucherActivite({ ids: ['a'], sans: false }, 'a'), { ids: [], sans: true })
})

test('toucherSans : non coché, vide les activités', () => {
  assert.deepEqual(toucherSans({ ids: ['a', 'b'], sans: false }, candidats), { ids: [], sans: true })
  assert.deepEqual(toucherSans(selectionVide(), candidats), { ids: [], sans: true })
})

test('toucherSans : coché, recoche la première activité, sinon rien', () => {
  assert.deepEqual(toucherSans({ ids: [], sans: true }, candidats), { ids: ['a'], sans: false })
  const sans = { ids: [], sans: true }
  assert.equal(toucherSans(sans, []), sans)
})

test('activitesAEnvoyer : ordre de la liste, champs du serveur, null sans activité', () => {
  assert.deepEqual(activitesAEnvoyer({ ids: ['c', 'a'], sans: false }, candidats), [
    { id: 'a', start_timestamp: 300, sport_type: 100 },
    { id: 'c', start_timestamp: 200, sport_type: null },
  ])
  assert.equal(activitesAEnvoyer({ ids: [], sans: true }, candidats), null)
  assert.equal(activitesAEnvoyer({ ids: ['a'], sans: true }, candidats), null)
  assert.equal(activitesAEnvoyer({ ids: ['z'], sans: false }, candidats), null)
})
