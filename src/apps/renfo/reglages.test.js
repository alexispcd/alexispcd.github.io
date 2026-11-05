// Tests des calculs des Réglages Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/reglages.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appliquerReport, lirePoids, memesReglages, nombreExercices, phraseSuppression, planDeReport,
} from './reglages.js'

const enr = (...kgs) => kgs.map((kg) => ({ kg, color: '#2F68CC' }))
const gardes = (...kgs) => kgs.map((kg) => ({ kg, color: '#2F68CC', origine: kg }))

test('lirePoids accepte la virgule et refuse le reste', () => {
  assert.equal(lirePoids('12,5'), 12.5)
  assert.equal(lirePoids(' 15 '), 15)
  assert.ok(Number.isNaN(lirePoids('')))
  assert.ok(Number.isNaN(lirePoids('abc')))
})

test('suppression avec égalité : le plus léger', () => {
  assert.deepEqual(planDeReport(enr(10, 15, 20), gardes(10, 20)), [{ de: 15, vers: 10 }])
})

test('modification 15 vers 16', () => {
  const brouillon = [...gardes(10), { kg: 16, color: '#2F68CC', origine: 15 }]
  assert.deepEqual(planDeReport(enr(10, 15), brouillon), [{ de: 15, vers: 16 }])
})

test('échange de deux poids', () => {
  const brouillon = [{ kg: 20, color: '#9FDCA9', origine: 10 }, { kg: 10, color: '#F2D16B', origine: 20 }]
  assert.deepEqual(planDeReport(enr(10, 20), brouillon), [{ de: 10, vers: 20 }, { de: 20, vers: 10 }])
  const bases = { a: { band_kg: 10 }, b: { band_kg: 20 }, c: { band_kg: null } }
  assert.deepEqual(appliquerReport(bases, planDeReport(enr(10, 20), brouillon)), {
    a: { band_kg: 20 }, b: { band_kg: 10 }, c: { band_kg: null },
  })
})

test('suppression en chaîne : tout va au restant', () => {
  assert.deepEqual(planDeReport(enr(10, 15, 20), gardes(20)), [{ de: 10, vers: 20 }, { de: 15, vers: 20 }])
})

test('ajouté puis supprimé : aucun report', () => {
  assert.deepEqual(planDeReport(enr(10, 20), gardes(10, 20)), [])
})

test('suppression puis rajout du même poids : aucun report', () => {
  const brouillon = [...gardes(10), { kg: 20, color: '#D64545', origine: null }]
  assert.deepEqual(planDeReport(enr(10, 20), brouillon), [])
})

test('dernier élastique supprimé : aucune entrée', () => {
  assert.deepEqual(planDeReport(enr(10), []), [])
})

test('nombreExercices compte après le report', () => {
  const bases = { a: { band_kg: 20 }, b: { band_kg: 20 }, c: { band_kg: 15 }, d: { band_kg: null }, e: {} }
  assert.equal(nombreExercices(bases, [], 20), 2)
  assert.equal(nombreExercices(bases, [{ de: 15, vers: 20 }], 20), 3)
  assert.equal(nombreExercices(bases, [{ de: 20, vers: 30 }], 20), 0)
})

test('les quatre phrases de suppression', () => {
  assert.equal(phraseSuppression(15, 3, null), "C'était ton dernier élastique : les exercices qui en demandent ne seront plus proposés.")
  assert.equal(phraseSuppression(15, 0, 10), "L'élastique de 15 kg ne sera plus proposé.")
  assert.equal(phraseSuppression(15, 1, 10), "L'élastique de 15 kg ne sera plus proposé. 1 exercice l'utilise : il passera à l'élastique le plus proche, 10 kg.")
  assert.equal(phraseSuppression(12.5, 4, 10), "L'élastique de 12,5 kg ne sera plus proposé. 4 exercices l'utilisent : ils passeront à l'élastique le plus proche, 10 kg.")
})

test('memesReglages ignore ordre et origine', () => {
  const a = { frequency: 2, equipment: ['bar', 'chair'], bands: [{ kg: 20, color: '#F2D16B' }, { kg: 10, color: '#9FDCA9' }] }
  const b = { frequency: 2, equipment: ['chair', 'bar'], bands: [{ kg: 10, color: '#9FDCA9', origine: 10 }, { kg: 20, color: '#F2D16B', origine: null }] }
  assert.ok(memesReglages(a, b))
  assert.ok(!memesReglages(a, { ...b, frequency: 3 }))
  assert.ok(!memesReglages(a, { ...b, equipment: ['bar'] }))
  assert.ok(!memesReglages(a, { ...b, bands: [{ kg: 10, color: '#2F68CC' }, { kg: 20, color: '#F2D16B' }] }))
})
