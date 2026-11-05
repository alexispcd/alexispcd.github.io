import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plannedMeters } from '../sessionMath.js'
import {
  titreCourt, libelleBloc, intensiteBloc, dernierJour, statutBloc, histogramme, hauteurBarre,
  sousLigne, prevu, realise, kmFaits, joursGrille, compteARebours, bandeauPasse, seancesDeSemaine,
  uneDecimale, formaterKm,
} from './vueSemaine.js'

const plan = { race_date: '2026-12-13', race_distance_m: 10000 }

test('plannedMeters : récupération sans allure à 0 m', () => {
  assert.equal(plannedMeters([{ step_type: 'recovery', duration_sec: 90 }]), 0)
})

test('plannedMeters : 900 s à 350 s/km, environ 2571 m', () => {
  assert.equal(Math.round(plannedMeters([{ step_type: 'run', duration_sec: 900, target_pace_sec: 350 }])), 2571)
})

test('plannedMeters : étape de 1000 m', () => {
  assert.equal(plannedMeters([{ step_type: 'interval', distance_m: 1000, target_pace_sec: 240 }]), 1000)
})

test('plannedMeters : fractionné, récup comprises à 0', () => {
  const steps = [
    { step_type: 'warmup', duration_sec: 900, target_pace_sec: 360 },
    { step_type: 'interval', distance_m: 1000 },
    { step_type: 'recovery', duration_sec: 90 },
    { step_type: 'interval', distance_m: 1000 },
  ]
  assert.equal(plannedMeters(steps), 2500 + 2000)
})

test('titre court : course le jour de plan.race_date', () => {
  const s = { scheduled_date: '2026-12-13', type: 'sortie_longue', title: 'Course', steps: [] }
  assert.equal(titreCourt(s, plan), '10 km')
  assert.equal(libelleBloc(s, plan), 'Course')
  assert.equal(intensiteBloc(s, plan), 'C')
})

test('titre court : répétitions en mètres, sans conversion en km', () => {
  const steps = [{ step_type: 'warmup', duration_sec: 900 }]
  for (let i = 0; i < 6; i += 1) steps.push({ step_type: 'interval', distance_m: 1000 }, { step_type: 'recovery', duration_sec: 90 })
  assert.equal(titreCourt({ type: 'fractionne', scheduled_date: '2026-11-04', steps }, plan), '6 × 1000 m')
})

test('titre court : répétitions en durée, minutes rondes ou m:ss', () => {
  const rep = (sec) => ({ step_type: 'interval', duration_sec: sec })
  assert.equal(titreCourt({ type: 'tempo', steps: [rep(480), rep(480), rep(480)] }, plan), '3 × 8 min')
  assert.equal(titreCourt({ type: 'fractionne', steps: [rep(150), rep(150)] }, plan), '2 × 2:30')
})

test('titre court : EF en durée ou en distance, d\'après la première étape', () => {
  assert.equal(titreCourt({ type: 'facile', steps: [{ step_type: 'run', duration_sec: 2700 }] }, plan), 'EF 45 min')
  assert.equal(titreCourt({ type: 'facile', steps: [{ step_type: 'run', distance_m: 10000 }] }, plan), 'EF 10 km')
})

test('titre court : SL aux km prévus arrondis', () => {
  const steps = [{ step_type: 'run', distance_m: 15800 }]
  assert.equal(titreCourt({ type: 'sortie_longue', steps }, plan), 'SL 16 km')
})

test('titre court : sinon le titre nettoyé', () => {
  const s = { type: 'tempo', title: 'Tempo \u2014 seuil', steps: [{ step_type: 'run', duration_sec: 1200 }] }
  assert.equal(titreCourt(s, plan), 'Tempo · seuil')
})

test('à faire, dernier jour : vrai le dernier jour du créneau, faux la veille et une fois faite', () => {
  // Zone B de la semaine du lundi 2 novembre 2026 : mercredi 4 au vendredi 6.
  const s = { status: 'planned', zone: 'B', scheduled_date: '2026-11-04' }
  assert.equal(dernierJour(s, '2026-11-06'), true)
  assert.equal(statutBloc(s, '2026-11-06').texte, 'à faire, dernier jour')
  assert.equal(dernierJour(s, '2026-11-05'), false)
  assert.equal(statutBloc(s, '2026-11-05').texte, 'à faire')
  assert.equal(dernierJour({ ...s, status: 'adapted' }, '2026-11-06'), true)
  assert.equal(dernierJour({ ...s, status: 'done' }, '2026-11-06'), false)
})

test('statut d\'un bloc : coche et km réalisés, coche et faite, sautée, adaptée', () => {
  const laps = [{ distance_m: 4000, duration_sec: 1400 }, { distance_m: 3900, duration_sec: 1360 }]
  assert.deepEqual(statutBloc({ status: 'done', actual_laps: laps }, '2026-11-05'), { coche: true, texte: '7,9 km' })
  assert.deepEqual(statutBloc({ status: 'done', actual_laps: [] }, '2026-11-05'), { coche: true, texte: 'faite' })
  assert.equal(statutBloc({ status: 'skipped', zone: 'A', scheduled_date: '2026-11-02' }, '2026-11-05').texte, 'sautée')
  assert.equal(statutBloc({ status: 'adapted', zone: 'C', scheduled_date: '2026-11-07' }, '2026-11-05').texte, 'adaptée')
})

test('histogramme : blocs regroupés par semaines consécutives', () => {
  const weeks = [
    ...[1, 2, 3, 4].map((n) => ({ week_number: n, block: 'construction', agg_distance_m: 30000 })),
    ...[5, 6, 7, 8].map((n) => ({ week_number: n, block: 'intensification', agg_distance_m: n === 7 ? 39400 : 35000 })),
    ...[9, 10, 11].map((n) => ({ week_number: n, block: 'affutage', agg_distance_m: 22300 })),
  ]
  const { blocs, max, semaines } = histogramme(weeks)
  assert.deepEqual(blocs.map(({ libelle, debut, span }) => ({ libelle, debut, span })), [
    { libelle: 'Construction', debut: 1, span: 4 },
    { libelle: 'Intensification', debut: 5, span: 4 },
    { libelle: 'Affûtage', debut: 9, span: 3 },
  ])
  assert.equal(max, 39.4)
  assert.equal(semaines.length, 11)
  assert.equal(hauteurBarre(39.4, 39.4), 84)
  assert.equal(hauteurBarre(22.3, 39.4), 48)
  assert.equal(uneDecimale(35.2), '35,2')
  assert.equal(uneDecimale(33), '33,0')
})

test('jour réel d\'une séance faite dans le tableau', () => {
  const s = {
    status: 'done', zone: 'B', scheduled_date: '2026-10-28',
    completed_at: '2026-10-30T10:00:00Z', analysis: { verdict: 'reussie' },
  }
  assert.equal(sousLigne(s), 'Ven 30, réussie')
  assert.equal(sousLigne({ ...s, analysis: null }), 'Ven 30, faite')
  assert.equal(sousLigne({ ...s, analysis: { verdict: 'a_retravailler' } }), 'Ven 30, à retravailler')
  assert.equal(sousLigne({ status: 'planned', zone: 'B' }), 'Mer-Ven, à faire')
  assert.equal(sousLigne({ status: 'skipped', zone: 'A' }), 'Lun-Mar, sautée')
})

test('prévu et réalisé du tableau', () => {
  assert.deepEqual(prevu({ type: 'facile', steps: [{ step_type: 'run', duration_sec: 2700, target_pace_sec: 350 }] }), { valeur: '45 min', allure: '' })
  assert.deepEqual(prevu({ type: 'sortie_longue', steps: [{ step_type: 'run', distance_m: 12000, target_pace_sec: 338 }] }), { valeur: '12 km', allure: '5:38 /km' })
  const fractionne = prevu({
    type: 'fractionne',
    steps: [
      { step_type: 'warmup', duration_sec: 900, target_pace_sec: 360 },
      { step_type: 'interval', distance_m: 1000, target_pace_sec: 243 },
      { step_type: 'recovery', duration_sec: 90 },
      { step_type: 'cooldown', duration_sec: 600, target_pace_sec: 360 },
    ],
  })
  assert.equal(fractionne.valeur, '≈ 31 min')
  assert.equal(fractionne.allure, '4:03 /km')
  assert.deepEqual(realise({ actual_laps: [] }), { valeur: '-', allure: '' })
  assert.deepEqual(realise({ actual_laps: [{ distance_m: 7900, duration_sec: 2749 }] }), { valeur: '7,9 km', allure: '5:48 /km' })
})

test('km faits : laps réels, sinon km prévus, rien pour une séance à faire', () => {
  const seances = [
    { status: 'done', actual_laps: [{ distance_m: 7900, duration_sec: 2749 }], agg_distance_m: 9000 },
    { status: 'done', actual_laps: null, agg_distance_m: 10000 },
    { status: 'planned', agg_distance_m: 12000 },
  ]
  assert.equal(kmFaits(seances), 17.9)
  assert.equal(kmFaits([]), 0)
  assert.equal(formaterKm(17.9), '17,9')
  assert.equal(formaterKm(0), '0')
})

test('grille : jours du lundi au dimanche, aujourd\'hui marqué', () => {
  const jours = joursGrille('2026-10-19', '2026-10-23')
  assert.deepEqual(jours.map((j) => `${j.jour} ${j.numero}`), ['Lun 19', 'Mar 20', 'Mer 21', 'Jeu 22', 'Ven 23', 'Sam 24', 'Dim 25'])
  assert.deepEqual(jours.map((j) => j.aujourdhui), [false, false, false, false, true, false, false])
})

test('séances d\'une semaine triées par date', () => {
  const sessions = [
    { id: 3, week_id: 'w', scheduled_date: '2026-10-24' },
    { id: 1, week_id: 'w', scheduled_date: '2026-10-19' },
    { id: 9, week_id: 'x', scheduled_date: '2026-10-20' },
  ]
  assert.deepEqual(seancesDeSemaine(sessions, 'w').map((s) => s.id), [1, 3])
})

test('bandeau : compte à rebours et plan passé', () => {
  assert.equal(compteARebours(45), 'J-45')
  assert.equal(compteARebours(-3), 'J-0')
  const passe = { race_date: '2026-09-13', race_distance_m: 21097, race_time_sec: 6324, goal_time_sec: 6300 }
  const sessions = [...Array(19).fill({ status: 'done' }), ...Array(8).fill({ status: 'skipped' })]
  assert.deepEqual(bandeauPasse(passe, sessions), [
    { etiquette: 'Semi · 2026', valeur: 'dim 13 sept' },
    { etiquette: 'Temps', valeur: '1:45:24' },
    { etiquette: 'Séances', valeur: '19 / 27' },
  ])
  assert.deepEqual(bandeauPasse({ ...passe, race_time_sec: null }, sessions)[1], { etiquette: 'Objectif', valeur: '1:45:00' })
})
