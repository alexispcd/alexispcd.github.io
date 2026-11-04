// Tests des formateurs de dates de Training (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatShortDay, joursCreneau, fenetreRecherche, plageRecherche, jourSeanceParDefaut,
} from './constants.js'

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

test('fenetreRecherche : semaine en cours, bornée à aujourd\'hui', () => {
  // Mercredi 4 novembre 2026, semaine du lundi 2.
  assert.deepEqual(fenetreRecherche('2026-11-02', '2026-11-03', '2026-11-04'), { debut: '2026-11-02', fin: '2026-11-04' })
  // Sans début de semaine : ancre sur la date prévue.
  assert.deepEqual(fenetreRecherche(null, '2026-11-07', '2026-11-04'), { debut: '2026-11-02', fin: '2026-11-04' })
})

test('fenetreRecherche : semaine passée, du lundi au dimanche', () => {
  assert.deepEqual(fenetreRecherche('2026-10-26', '2026-10-27', '2026-11-04'), { debut: '2026-10-26', fin: '2026-11-01' })
  // Première semaine partielle d'un plan (début un jeudi) : depuis le lundi.
  assert.deepEqual(fenetreRecherche('2026-10-29', '2026-10-31', '2026-11-04'), { debut: '2026-10-26', fin: '2026-11-01' })
})

test('fenetreRecherche : semaine à venir, jamais avant le lundi ; sans date', () => {
  assert.deepEqual(fenetreRecherche('2026-11-09', '2026-11-10', '2026-11-04'), { debut: '2026-11-09', fin: '2026-11-09' })
  assert.equal(fenetreRecherche(null, null, '2026-11-04'), null)
})

test('plageRecherche : un jour, même mois, mois différents', () => {
  assert.equal(plageRecherche({ debut: '2026-11-02', fin: '2026-11-02' }), 'le lun 2 nov')
  assert.equal(plageRecherche({ debut: '2026-11-02', fin: '2026-11-04' }), 'entre le lun 2 et le mer 4 nov')
  assert.equal(plageRecherche({ debut: '2026-10-26', fin: '2026-11-04' }), 'entre le lun 26 oct et le mer 4 nov')
})

test('jourSeanceParDefaut : jamais un jour à venir', () => {
  assert.equal(jourSeanceParDefaut('2026-10-27', '2026-11-04'), '2026-10-27')
  assert.equal(jourSeanceParDefaut('2026-11-06', '2026-11-04'), '2026-11-04')
  assert.equal(jourSeanceParDefaut(null, '2026-11-04'), '2026-11-04')
})
