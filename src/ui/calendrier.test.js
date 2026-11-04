// Tests de la grille du Calendrier (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grilleMois, moisDe, moisVoisin, libelleMois } from './calendrier.js'

const jours = (grille) => grille.filter(Boolean)

test('grilleMois : mois qui commence un lundi', () => {
  // Mars 2027 commence un lundi.
  const g = grilleMois('2027-03')
  assert.equal(g.length, 42)
  assert.equal(g[0], '2027-03-01')
  assert.equal(g[30], '2027-03-31')
  assert.equal(g[31], null)
  assert.equal(jours(g).length, 31)
})

test('grilleMois : mois qui commence un dimanche, sur 6 rangées', () => {
  // Août 2026 commence un samedi, novembre 2026 un dimanche.
  const nov = grilleMois('2026-11')
  assert.equal(nov.length, 42)
  assert.deepEqual(nov.slice(0, 6), [null, null, null, null, null, null])
  assert.equal(nov[6], '2026-11-01')
  assert.equal(nov[35], '2026-11-30')
  const aout = grilleMois('2026-08')
  assert.equal(aout[5], '2026-08-01')
  assert.equal(aout[35], '2026-08-31')
})

test('grilleMois : février bissextile', () => {
  const g = grilleMois('2028-02')
  assert.equal(jours(g).length, 29)
  assert.equal(jours(g).at(-1), '2028-02-29')
  assert.equal(jours(grilleMois('2027-02')).length, 28)
})

test('moisVoisin, moisDe et libelleMois : passage d\'année', () => {
  assert.equal(moisVoisin('2026-12', 1), '2027-01')
  assert.equal(moisVoisin('2027-01', -1), '2026-12')
  assert.equal(moisVoisin('2026-10', 1), '2026-11')
  assert.equal(moisDe('2027-01-26'), '2027-01')
  assert.equal(libelleMois('2026-10'), 'octobre 2026')
  assert.equal(libelleMois('2027-02'), 'février 2027')
})
