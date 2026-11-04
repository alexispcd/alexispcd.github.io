// Tests des formateurs de dates de Training (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatShortDay } from './constants.js'

test('formatShortDay : jour, date et mois abrégés sans point', () => {
  assert.equal(formatShortDay('2026-10-29'), 'jeu 29 oct')
  assert.equal(formatShortDay('2026-09-13'), 'dim 13 sept')
  assert.equal(formatShortDay('2026-08-01'), 'sam 1 août')
})

test('formatShortDay : valeur absente ou invalide', () => {
  assert.equal(formatShortDay(null), '')
  assert.equal(formatShortDay('pas une date'), '')
})
