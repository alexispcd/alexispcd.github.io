// Tests des calculs de l'accueil Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/accueil.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jourLocal, libelleSemaine, ligneHistorique, phraseEnAttente, phraseSuggestion, semaineEnCours } from './accueil.js'

// Horodatage d'une heure locale, quel que soit le fuseau de la machine.
const local = (y, m, d, h = 18, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const faite = (iso, ...focuses) => ({
  completed_at: iso,
  content: { blocks: focuses.map((focus) => ({ type: 'superset', focus, rounds: 3, rest_sec: 60, exercises: [{ slug: 'pompes', reps: 10 }] })) },
})

test('semaineEnCours : lundi et dimanche bornent la semaine', () => {
  const sessions = [
    faite(local(2026, 11, 1, 20)), // dimanche d'avant
    faite(local(2026, 11, 2, 7)), // lundi
    faite(local(2026, 11, 8, 21)), // dimanche
    faite(local(2026, 11, 9, 6)), // lundi d'après
  ]
  const lundi = semaineEnCours(sessions, '2026-11-02', 2)
  assert.equal(lundi.lundi, '2026-11-02')
  assert.equal(lundi.compte, 2)
  assert.deepEqual(lundi.jours, [true, false, false, false, false, false, true])
  assert.equal(lundi.atteint, true)
  // Un dimanche voit la même semaine.
  assert.deepEqual(semaineEnCours(sessions, '2026-11-08', 3).jours, lundi.jours)
  assert.equal(semaineEnCours(sessions, '2026-11-08', 3).atteint, false)
})

test('semaineEnCours : passage de mois et séance à 23 h 30 heure locale', () => {
  const sessions = [faite(local(2026, 10, 31, 23, 30)), faite(local(2026, 10, 25, 23, 30))]
  const s = semaineEnCours(sessions, '2026-10-29', 1)
  assert.equal(s.lundi, '2026-10-26')
  assert.equal(s.compte, 1)
  assert.deepEqual(s.jours, [false, false, false, false, false, true, false])
  assert.equal(jourLocal(local(2026, 10, 31, 23, 30)), '2026-10-31')
  assert.equal(semaineEnCours([], '2026-10-29', 1).compte, 0)
})

test('libelleSemaine : même mois, deux mois, deux années', () => {
  assert.equal(libelleSemaine('2026-11-02'), '2-8 nov')
  assert.equal(libelleSemaine('2026-10-26'), '26 oct-1 nov')
  assert.equal(libelleSemaine('2026-12-28'), '28 déc-3 janv')
})

test('phraseSuggestion : date la plus récente des groupes, ou jamais travaillé', () => {
  const composition = { supersets: [{ focus: 'legs' }, { focus: 'foot_calf' }, { focus: 'core_stability' }] }
  const sessions = [faite(local(2026, 10, 20, 23, 30), 'quads', 'trunk'), faite(local(2026, 10, 24), 'pull')]
  assert.equal(phraseSuggestion(composition, sessions), 'Jambes et tronc : rien depuis mar 20 oct')
  assert.equal(phraseSuggestion(composition, []), 'Jambes et tronc : pas encore travaillé')
})

test('phraseEnAttente : jour de création', () => {
  assert.equal(phraseEnAttente({ created_at: local(2026, 10, 25, 9) }), 'Créée dim 25 oct, pas encore faite')
})

test('resumeComposition : intensité et supersets', async () => {
  const { resumeComposition } = await import('./accueil.js')
  assert.equal(resumeComposition('normale', 3), 'Normale · 3 supersets')
  assert.equal(resumeComposition('legere', 1), 'Légère · 1 superset')
})

test('ligneHistorique : séances faites du mois en cours, jour local', () => {
  const sessions = [
    faite(local(2026, 11, 1, 7)),
    faite(local(2026, 11, 4, 23, 30)),
    faite(local(2026, 10, 31, 23, 30)), // octobre, même tard le soir
    faite(local(2025, 11, 3)), // novembre d'une autre année
  ]
  assert.equal(ligneHistorique(sessions, '2026-11-05'), '2 séances faites en novembre')
  assert.equal(ligneHistorique(sessions.slice(1), '2026-11-05'), '1 séance faite en novembre')
  assert.equal(ligneHistorique([], '2026-12-01'), 'Aucune séance en décembre')
  assert.equal(ligneHistorique(sessions, '2026-10-12'), '1 séance faite en octobre')
})
