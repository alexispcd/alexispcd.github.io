// Tests des formateurs de dates de Training (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatShortDay, joursCreneau } from './constants.js'

test('formatShortDay : jour, date et mois abrégés sans point', () => {
  assert.equal(formatShortDay('2026-10-29'), 'jeu 29 oct')
  assert.equal(formatShortDay('2026-09-13'), 'dim 13 sept')
  assert.equal(formatShortDay('2026-08-01'), 'sam 1 août')
})

test('formatShortDay : valeur absente ou invalide', () => {
  assert.equal(formatShortDay(null), '')
  assert.equal(formatShortDay('pas une date'), '')
})

test('joursCreneau : dates du créneau dans la semaine du lundi', () => {
  // Jeudi 29 octobre 2026 : semaine du lundi 26.
  assert.deepEqual(joursCreneau('2026-10-29', 'A'), ['2026-10-26', '2026-10-27'])
  assert.deepEqual(joursCreneau('2026-10-29', 'B'), ['2026-10-28', '2026-10-29', '2026-10-30'])
  assert.deepEqual(joursCreneau('2026-10-29', 'C'), ['2026-10-31', '2026-11-01'])
})

test('joursCreneau : un dimanche appartient à la semaine commencée le lundi précédent', () => {
  assert.deepEqual(joursCreneau('2026-11-01', 'C'), ['2026-10-31', '2026-11-01'])
  assert.deepEqual(joursCreneau('2026-11-01', 'A'), ['2026-10-26', '2026-10-27'])
})

test('joursCreneau : passage de mois et d\'année, valeurs absentes', () => {
  assert.deepEqual(joursCreneau('2027-01-01', 'B'), ['2026-12-30', '2026-12-31', '2027-01-01'])
  assert.deepEqual(joursCreneau(null, 'A'), [])
  assert.deepEqual(joursCreneau('2026-10-29', 'Z'), [])
})
