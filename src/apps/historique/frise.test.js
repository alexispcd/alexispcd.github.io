// Tests de la frise de l'Historique des séances (node:test, sans dépendance).
// Lancement : node --test src/apps/historique/frise.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { construireFrise, libelleJour, libelleMoisFrise } from './frise.js'

// Horodatage d'une heure locale, quel que soit le fuseau de la machine.
const local = (y, m, d, h = 18, min = 0) => new Date(y, m - 1, d, h, min).toISOString()

const plan = (over = {}) => ({
  id: 'p1', race_name: 'Pr 10k', start_date: '2026-10-05', race_date: '2026-12-20',
  race_distance_m: 10000, goal_time_sec: 2640, race_time_sec: null, ...over,
})
const course = (over = {}) => ({
  id: 's1', plan_id: 'p1', title: 'Footing', status: 'done', type: 'facile', zone: 'A',
  completed_at: local(2026, 11, 2), scheduled_date: '2026-11-02',
  actual_laps: [{ distance_m: 5000, duration_sec: 1500 }, { distance_m: 4600, duration_sec: 1424 }],
  rpe: 8, verdict: 'reussie', ...over,
})
const renfo = (over = {}) => ({ id: 'r1', title: 'Jambes et tronc', completed_at: local(2026, 11, 3), rpe: 6, estimated_min: '35', ...over })

const lignes = (frise, type) => frise.elements.filter((e) => e.type === type)
const ligneDu = (frise, date) => frise.elements.find((e) => e.date === date)

test('libellés : jour court, mois de l\'année en cours ou d\'une autre année', () => {
  assert.equal(libelleJour('2026-10-31'), 'Sam 31')
  assert.equal(libelleMoisFrise('2026-10', '2026-11-05'), 'Octobre')
  assert.equal(libelleMoisFrise('2025-12', '2026-01-03'), 'Décembre 2025')
})

test('séance de course faite : chiffres, verdict et effort, couleur de son intensité', () => {
  const f = construireFrise({ seances: [course()], plans: [plan()], aujourdhui: '2026-11-05' })
  const s = lignes(f, 'seance')[0]
  assert.equal(s.titre, 'Footing')
  assert.equal(s.chiffres, '9,6 km · 5:05 /km · 48:44')
  assert.equal(s.legende, 'Séance réussie · effort 8 / 10')
  assert.deepEqual(s.marque, { etat: 'faite', zone: 'facile' })
  assert.equal(s.lien, '/training/plan/p1/session/s1')
  assert.equal(s.date, 'Lun 2')
  // Qualité dans le créneau A : la couleur suit le type, pas la zone.
  const q = construireFrise({ seances: [course({ type: 'tempo' })], aujourdhui: '2026-11-05' })
  assert.equal(lignes(q, 'seance')[0].marque.zone, 'qualite')
})

test('séance sans laps : pas de chiffres ; effort seul ou rien', () => {
  const f = construireFrise({ seances: [course({ actual_laps: null, verdict: null })], aujourdhui: '2026-11-05' })
  const s = lignes(f, 'seance')[0]
  assert.equal(s.chiffres, null)
  assert.equal(s.legende, 'Effort 8 / 10')
  const g = construireFrise({ seances: [course({ actual_laps: [], verdict: null, rpe: null })], aujourdhui: '2026-11-05' })
  assert.equal(lignes(g, 'seance')[0].legende, null)
})

test('séance faite à 23 h 30 heure locale : sur son jour', () => {
  const f = construireFrise({ renfo: [renfo({ completed_at: local(2026, 10, 31, 23, 30) })], aujourdhui: '2026-11-02' })
  const s = lignes(f, 'seance')[0]
  assert.equal(s.date, 'Sam 31')
  assert.equal(f.elements.at(-1), s)
})

test('repli sur scheduled_date sans completed_at', () => {
  const f = construireFrise({ seances: [course({ completed_at: null, scheduled_date: '2026-11-01' })], aujourdhui: '2026-11-02' })
  assert.equal(lignes(f, 'seance')[0].date, 'Dim 1')
})

test('deux séances le même jour : une ligne chacune, la date sur la première', () => {
  const f = construireFrise({
    seances: [course({ completed_at: local(2026, 11, 3, 7) })],
    renfo: [renfo({ completed_at: local(2026, 11, 3, 19) })],
    aujourdhui: '2026-11-03',
  })
  const [a, b] = lignes(f, 'seance')
  assert.equal(a.titre, 'Jambes et tronc')
  assert.equal(a.date, 'Mar 3')
  assert.equal(a.aujourdhui, true)
  assert.equal(b.titre, 'Footing')
  assert.equal(b.date, null)
  assert.equal(lignes(f, 'repos').length, 0)
})

test('séance sautée : à sa date prévue, jamais après aujourd\'hui', () => {
  const f = construireFrise({
    seances: [
      course(),
      course({ id: 's2', status: 'skipped', completed_at: null, scheduled_date: '2026-11-04', zone: 'B', type: 'fractionne', title: 'VMA' }),
      course({ id: 's3', status: 'skipped', completed_at: null, scheduled_date: '2026-11-06', zone: 'B' }),
    ],
    aujourdhui: '2026-11-05',
  })
  const sautees = lignes(f, 'seance').filter((s) => s.marque.etat === 'sautee')
  assert.equal(sautees.length, 1)
  assert.equal(sautees[0].date, 'Mer 4')
  assert.equal(sautees[0].chiffres, 'Sautée · créneau Mer-Ven')
  assert.equal(sautees[0].legende, null)
  assert.deepEqual(sautees[0].marque, { etat: 'sautee', zone: 'qualite' })
})

test('jours de repos, aujourd\'hui compris, et rail coupé en bas', () => {
  const f = construireFrise({ renfo: [renfo({ completed_at: local(2026, 11, 3) })], aujourdhui: '2026-11-05' })
  const types = f.elements.map((e) => e.type)
  assert.deepEqual(types, ['mois', 'repos', 'repos', 'seance'])
  assert.equal(f.elements[1].date, 'Jeu 5')
  assert.equal(f.elements[1].aujourdhui, true)
  assert.equal(f.elements[2].aujourdhui, false)
  assert.equal(f.elements[3].finRail, true)
  assert.equal(f.elements[1].finRail, false)
})

test('filet de semaine dans un plan, rien entre deux plans ni hors plan', () => {
  const plans = [
    plan({ id: 'p2', race_name: 'Pr 10k', start_date: '2026-10-19', race_date: '2026-12-20' }),
    plan({ id: 'p1', race_name: 'Auray Vannes', start_date: '2026-09-28', race_date: '2026-10-11' }),
  ]
  const f = construireFrise({
    seances: [course({ completed_at: local(2026, 10, 1), scheduled_date: '2026-10-01' })],
    plans,
    aujourdhui: '2026-10-27',
  })
  const filets = lignes(f, 'filet').map((e) => e.cle)
  // Dim 25 / lun 26 dans Pr 10k ; dim 4 / lun 5 dans Auray Vannes. Dim 18 / lun 19 :
  // deux plans. Dim 11 / lun 12 : le lundi est hors plan.
  assert.deepEqual(filets, ['filet-2026-10-25', 'filet-2026-10-04'])
  // Le filet passe entre le lundi et le dimanche.
  const i = f.elements.findIndex((e) => e.cle === 'filet-2026-10-25')
  assert.equal(f.elements[i - 1].date, 'Lun 26')
  assert.equal(f.elements[i + 1].date, 'Dim 25')
})

test('pas de filet là où le mois change', () => {
  // Dim 31 mai / lun 1 juin dans un même plan : le titre du mois suffit.
  const f = construireFrise({
    seances: [course({ completed_at: local(2026, 5, 30), scheduled_date: '2026-05-30' })],
    plans: [plan({ start_date: '2026-05-01', race_date: '2026-06-30' })],
    aujourdhui: '2026-06-02',
  })
  assert.equal(lignes(f, 'filet').some((e) => e.cle === 'filet-2026-05-31'), false)
  assert.equal(lignes(f, 'filet').some((e) => e.cle === 'filet-2026-05-24'), true)
})

test('total du mois : km des courses faites, séances course et Renfo, rien de sauté', () => {
  const f = construireFrise({
    seances: [
      course(),
      course({ id: 's2', completed_at: local(2026, 11, 4), actual_laps: [{ distance_m: 12345, duration_sec: 3600 }] }),
      course({ id: 's3', status: 'skipped', completed_at: null, scheduled_date: '2026-11-01' }),
      course({ id: 's4', completed_at: local(2026, 10, 20) }),
    ],
    renfo: [renfo()],
    aujourdhui: '2026-11-05',
  })
  const mois = lignes(f, 'mois')
  assert.deepEqual(mois.map((m) => m.titre), ['Novembre', 'Octobre'])
  assert.equal(mois[0].total, '21,9 km · 3 séances')
  assert.equal(mois[1].total, '9,6 km · 1 séance')
  // Un mois sans rien.
  const g = construireFrise({ renfo: [renfo({ completed_at: local(2026, 9, 30) })], aujourdhui: '2026-11-05' })
  assert.deepEqual(lignes(g, 'mois').map((m) => m.total), ['Aucune séance', 'Aucune séance', '1 séance'])
  // Le rail s'arrête avant chaque titre de mois.
  const avantOctobre = g.elements[g.elements.findIndex((e) => e.titre === 'Octobre') - 1]
  assert.equal(avantOctobre.finRail, true)
})

test('passage d\'année : l\'année sur les mois d\'avant', () => {
  const f = construireFrise({ renfo: [renfo({ completed_at: local(2025, 12, 30) })], aujourdhui: '2026-01-02' })
  assert.deepEqual(lignes(f, 'mois').map((m) => m.titre), ['Janvier', 'Décembre 2025'])
})

test('jalons : début du plan sous son premier jour, course passée avec ou sans temps', () => {
  const plans = [plan({ id: 'p1', race_name: 'Auray Vannes', start_date: '2026-09-07', race_date: '2026-09-13', race_distance_m: 21097, goal_time_sec: 5880, race_time_sec: 6324 })]
  const f = construireFrise({ renfo: [renfo({ completed_at: local(2026, 9, 10) })], plans, aujourdhui: '2026-09-14' })
  const c = lignes(f, 'course')[0]
  assert.equal(c.titre, 'Auray Vannes')
  assert.equal(c.chiffres, 'Semi · 1:45:24')
  assert.equal(c.legende, 'Course · objectif 1:38:00')
  assert.equal(c.date, 'Dim 13')
  assert.equal(c.lien, undefined)
  const debut = lignes(f, 'debut')[0]
  assert.equal(debut.texte, 'Début de Auray Vannes')
  const i = f.elements.indexOf(debut)
  assert.equal(f.elements[i - 1].date, 'Lun 7')
  assert.equal(debut.finRail, true)
  // Sans race_time_sec : la distance seule.
  const g = construireFrise({ renfo: [renfo({ completed_at: local(2026, 9, 10) })], plans: [{ ...plans[0], race_time_sec: null }], aujourdhui: '2026-09-14' })
  assert.equal(lignes(g, 'course')[0].chiffres, 'Semi')
})

test('course à venir : absente', () => {
  const f = construireFrise({ seances: [course()], plans: [plan()], aujourdhui: '2026-11-05' })
  assert.equal(lignes(f, 'course').length, 0)
  // Le début du plan, passé, est là, et la frise descend jusqu'à lui.
  assert.equal(lignes(f, 'debut')[0].texte, 'Début de Pr 10k')
  assert.equal(f.elements.at(-1).type, 'debut')
})

// Ancien titre de cycle : coupé avant le tiret entouré d'espaces (écrit en échappement).
test('compte Renfo seul : titre court, durée estimée, effort', () => {
  const f = construireFrise({ renfo: [renfo({ title: 'Haut du corps \u2013 Cycle 2', rpe: null, estimated_min: null })], aujourdhui: '2026-11-03' })
  const s = lignes(f, 'seance')[0]
  assert.equal(s.titre, 'Haut du corps')
  assert.equal(s.chiffres, 'Renfo')
  assert.equal(s.legende, null)
  assert.deepEqual(s.marque, { etat: 'faite', zone: 'ink' })
  assert.equal(s.lien, '/renfo/session/r1')
  const g = construireFrise({ renfo: [renfo()], aujourdhui: '2026-11-03' })
  assert.equal(lignes(g, 'seance')[0].chiffres, 'Renfo · ≈ 35 min')
  assert.equal(lignes(g, 'seance')[0].legende, 'Effort 6 / 10')
})

test('compte Training seul et frise vide', () => {
  const f = construireFrise({ seances: [course()], plans: [plan()], aujourdhui: '2026-11-05' })
  assert.equal(f.vide, false)
  assert.ok(lignes(f, 'seance').every((s) => s.lien.startsWith('/training/')))
  assert.deepEqual(construireFrise({ aujourdhui: '2026-11-05' }), { vide: true, elements: [] })
  // Des séances sautées seules : rien de fait.
  const g = construireFrise({ seances: [course({ status: 'skipped', completed_at: null })], plans: [plan()], aujourdhui: '2026-11-05' })
  assert.equal(g.vide, true)
  assert.equal(ligneDu(g, 'Lun 2'), undefined)
})
