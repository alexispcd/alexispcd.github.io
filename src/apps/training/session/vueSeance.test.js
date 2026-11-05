import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  libelleIntensite, etatSeance, sousLigneSeance, erreurMontre, segmentsStructure, distancePrevue,
  chiffresSeance, etapesDansCible, analyseSeance, ressentiSeance, formatEcart, surDuree,
  lignesStructure, etapesGraphe, etapesKm, etapeDuKm, ligneKm, graphe,
} from './vueSeance.js'

const plan = { status: 'active', race_date: '2026-12-20', race_distance_m: 10000 }

// Tempo progressif 3x8 min, structure et laps d'une vraie séance (troisième répétition coupée).
const steps3x8 = [
  { step_type: 'warmup', target_pace_sec: 350, pace_tolerance_sec: 12, duration_sec: 900 },
  { step_type: 'interval', repeat_group: 1, repeat_index: 1, target_pace_sec: 257, pace_tolerance_sec: 5, duration_sec: 480 },
  { step_type: 'recovery', repeat_group: 1, repeat_index: 1, target_pace_sec: null, duration_sec: 120 },
  { step_type: 'interval', repeat_group: 1, repeat_index: 2, target_pace_sec: 257, pace_tolerance_sec: 5, duration_sec: 480 },
  { step_type: 'recovery', repeat_group: 1, repeat_index: 2, target_pace_sec: null, duration_sec: 120 },
  { step_type: 'interval', repeat_group: 1, repeat_index: 3, target_pace_sec: 257, pace_tolerance_sec: 5, duration_sec: 480 },
  { step_type: 'recovery', repeat_group: 1, repeat_index: 3, target_pace_sec: null, duration_sec: 120 },
  { step_type: 'cooldown', target_pace_sec: 355, pace_tolerance_sec: 12, duration_sec: 600 },
]
const laps3x8 = [
  [2582.66, 900], [1904.32, 480], [301.97, 120], [1913.17, 480],
  [343.33, 120], [42.26, 17], [324.43, 120], [1520.27, 551],
].map(([distance_m, duration_sec], i) => ({ lap_index: i, step_index: i, distance_m, duration_sec, avg_pace_sec: Math.round(duration_sec / (distance_m / 1000)) }))
const comps3x8 = [
  { step_index: 0, status: 'ok', actual_pace: 348, planned_pace: 350, delta_sec: -2 },
  { step_index: 1, status: 'ok', actual_pace: 252, planned_pace: 257, delta_sec: -5 },
  { step_index: 2, status: 'free', actual_pace: 397, planned_pace: null, delta_sec: null },
  { step_index: 3, status: 'proche', actual_pace: 251, planned_pace: 257, delta_sec: -6 },
  { step_index: 4, status: 'free', actual_pace: 350, planned_pace: null, delta_sec: null },
  { step_index: 5, status: 'ecart', actual_pace: 402, planned_pace: 257, delta_sec: 145 },
  { step_index: 6, status: 'free', actual_pace: 370, planned_pace: null, delta_sec: null },
  { step_index: 7, status: 'ok', actual_pace: 362, planned_pace: 355, delta_sec: 7 },
]
const faite = {
  status: 'done', type: 'tempo', zone: 'B', scheduled_date: '2026-10-14', completed_at: '2026-10-15T07:30:00Z',
  steps: steps3x8, actual_laps: laps3x8,
  analysis: { verdict: 'partiellement', advice: 'Conseil \u2014 net.', comparisons: comps3x8 },
}

const tempo = {
  status: 'planned', type: 'tempo', zone: 'B', scheduled_date: '2026-10-28',
  steps: [
    { step_type: 'warmup', target_pace_sec: 350, pace_tolerance_sec: 12, duration_sec: 900 },
    { step_type: 'run', target_pace_sec: 254, pace_tolerance_sec: 5, duration_sec: 1200 },
    { step_type: 'cooldown', target_pace_sec: 355, pace_tolerance_sec: 12, duration_sec: 600 },
  ],
}

test('libellé : intensité du type, et Course le jour de la course', () => {
  assert.equal(libelleIntensite({ type: 'facile' }, plan), 'Facile')
  assert.equal(libelleIntensite({ type: 'sortie_longue' }, plan), 'Longue')
  assert.equal(libelleIntensite({ type: 'tempo' }, plan), 'Qualité · Tempo')
  assert.equal(libelleIntensite({ type: 'fractionne' }, plan), 'Qualité · Fractionné')
  assert.equal(libelleIntensite({ type: 'sortie_longue', scheduled_date: '2026-12-20' }, plan), 'Course')
})

test('état : marque et texte de la pastille', () => {
  assert.deepEqual(etatSeance('planned'), { marque: 'aFaire', texte: 'À faire' })
  assert.deepEqual(etatSeance('adapted'), { marque: 'adaptee', texte: 'Adaptée' })
  assert.deepEqual(etatSeance('done'), { marque: 'faite', texte: 'Faite' })
  assert.deepEqual(etatSeance('skipped'), { marque: 'sautee', texte: 'Sautée' })
})

test('sous-ligne : faite, sur la montre, sinon créneau', () => {
  assert.equal(sousLigneSeance(faite), 'Faite jeu 15 oct')
  assert.equal(sousLigneSeance({ ...tempo, coros_workout_id: '1', coros_workout_date: '2026-10-29' }), 'Prévue jeu 29 oct')
  assert.equal(sousLigneSeance(tempo), 'Créneau Mer-Ven')
  // Sautée : la copie sur la montre ne compte plus.
  assert.equal(sousLigneSeance({ ...tempo, status: 'skipped', coros_workout_id: '1', coros_workout_date: '2026-10-29' }), 'Créneau Mer-Ven')
})

test('erreur de la montre : seulement pour une séance à faire sur la montre', () => {
  const s = { ...tempo, coros_workout_id: '1', coros_sync_error: 'Mise à jour impossible.' }
  assert.equal(erreurMontre(s), 'Mise à jour impossible.')
  assert.equal(erreurMontre({ ...s, status: 'done' }), null)
  assert.equal(erreurMontre({ ...s, coros_workout_id: null }), null)
})

test('segments de la structure', () => {
  assert.deepEqual(segmentsStructure(steps3x8.slice(0, 3)), [
    { duree: 900, type: 'calme' }, { duree: 480, type: 'effort' }, { duree: 120, type: 'recup' },
  ])
})

test('distance prévue : rien avec une récupération sans allure', () => {
  assert.equal(distancePrevue(steps3x8), null)
  assert.equal(Math.round(distancePrevue(tempo.steps)), 8986)
  assert.equal(distancePrevue([{ step_type: 'recovery', distance_m: 400 }, { step_type: 'interval', distance_m: 800, target_pace_sec: 226 }]), 1200)
})

test('chiffres d\'une séance pas faite : durée, distance, allure clé', () => {
  assert.deepEqual(chiffresSeance(tempo), [
    { etiquette: 'Durée', valeur: '≈ 45', unite: ' min', prevu: '' },
    { etiquette: 'Distance', valeur: '≈ 9,0', unite: ' km', prevu: '' },
    { etiquette: 'Allure clé', valeur: '4:14', unite: ' /km', prevu: '' },
  ])
})

test('chiffres d\'un fractionné : durée et allure clé, pas de distance', () => {
  const s = { ...faite, status: 'planned', actual_laps: null }
  assert.deepEqual(chiffresSeance(s).map((c) => c.etiquette), ['Durée', 'Allure clé'])
})

test('chiffres d\'une séance faite : réalisé, prévu dessous', () => {
  assert.deepEqual(chiffresSeance(faite), [
    { etiquette: 'Distance', valeur: '8,9', unite: ' km', prevu: '' },
    { etiquette: 'Durée', valeur: '46:28', unite: '', prevu: 'prévu ≈ 55 min' },
    { etiquette: 'Allure moy.', valeur: '5:12', unite: ' /km', prevu: 'clé prévue 4:17' },
  ])
  const avecDistance = { ...tempo, status: 'done', actual_laps: [{ step_index: 1, distance_m: 9100, duration_sec: 2700 }] }
  assert.equal(chiffresSeance(avecDistance)[0].prevu, 'prévu ≈ 9,0 km')
  assert.equal(chiffresSeance(avecDistance)[1].valeur, '45:00')
})

test('chiffres d\'une séance faite sans laps : le prévu', () => {
  assert.equal(chiffresSeance({ ...tempo, status: 'done' })[0].valeur, '≈ 45')
})

test('analyse : verdict, étapes dans la cible et conseil nettoyé', () => {
  assert.equal(etapesDansCible(comps3x8), '3 étapes sur 5 dans la cible')
  assert.equal(etapesDansCible([{ status: 'ok' }, { status: 'ecart' }]), '1 étape sur 2 dans la cible')
  assert.deepEqual(analyseSeance(faite), {
    verdict: 'Séance partiellement réussie', cible: '3 étapes sur 5 dans la cible', conseil: 'Conseil · net.', repli: null,
  })
})

test('analyse sans verdict : le sens de l\'ancien bloc', () => {
  const sansVerdict = { ...faite, analysis: { verdict: null, advice: null, comparisons: comps3x8 } }
  assert.equal(analyseSeance(sansVerdict).repli, '3 étapes sur 5 dans la cible. Analyse détaillée indisponible.')
  assert.equal(analyseSeance({ ...faite, analysis: { verdict: null, advice: 'Repose-toi.' } }).conseil, 'Repose-toi.')
  assert.equal(analyseSeance({ ...faite, analysis: null }), null)
  assert.equal(analyseSeance({ ...faite, analysis: { verdict: null, advice: null, comparisons: [] } }), null)
})

test('ressenti : rien sans saisie', () => {
  assert.equal(ressentiSeance(faite), null)
  assert.deepEqual(ressentiSeance({ ...faite, rpe: 6, pain_areas: ['genou_g'], feedback_note: ' Chute. ' }), {
    rpe: 6, note: 'Chute.', douleurs: ['Genou G'],
  })
})

test('écart : -5 s, +7 s, +2:25 au-delà de 60 s', () => {
  assert.equal(formatEcart(-5), '-5 s')
  assert.equal(formatEcart(7), '+7 s')
  assert.equal(formatEcart(145), '+2:25')
  assert.equal(formatEcart(-60), '-1:00')
  assert.equal(formatEcart(0), '0 s')
  assert.equal(formatEcart(null), '')
})

test('« sur 17 s » seulement sous la moitié du prévu', () => {
  assert.equal(surDuree(faite, 5), ', sur 17 s')
  assert.equal(surDuree(faite, 1), '')
  const moitie = { ...faite, actual_laps: [{ step_index: 1, duration_sec: 240, distance_m: 900 }] }
  assert.equal(surDuree(moitie, 1), '')
  assert.equal(surDuree({ ...faite, actual_laps: [] }, 1), '')
})

test('structure d\'une séance à faire : allure et tolérance', () => {
  const lignes = lignesStructure(tempo)
  assert.deepEqual(lignes.map((l) => [l.nom, l.detail, l.marqueur, l.allure, l.tolerance]), [
    ['Échauffement', '15 min', 'calme', '5:50', '±12 s'],
    ['Tempo', '20 min', 'effort', '4:14', '±5 s'],
    ['Retour au calme', '10 min', 'calme', '5:55', '±12 s'],
  ])
})

test('structure : groupe et répétitions d\'une séance faite', () => {
  const lignes = lignesStructure(faite)
  assert.equal(lignes.length, 3)
  assert.deepEqual([lignes[0].cible, lignes[0].realise, lignes[0].ecart], ['5:50', '5:48', '-2 s'])
  const groupe = lignes[1]
  assert.equal(groupe.nom, '3 × 8 min')
  assert.equal(groupe.detail, 'récup 2 min entre chaque')
  assert.equal(groupe.cible, '4:17')
  assert.deepEqual(groupe.repetitions, [
    { libelle: 'Rép 1', extra: '', realise: '4:12', ecart: '-5 s' },
    { libelle: 'Rép 2', extra: '', realise: '4:11', ecart: '-6 s' },
    { libelle: 'Rép 3', extra: ', sur 17 s', realise: '6:42', ecart: '+2:25' },
  ])
  assert.deepEqual([lignes[2].realise, lignes[2].ecart], ['6:02', '+7 s'])
})

test('structure : répétitions en mètres sans conversion', () => {
  const s = { status: 'planned', type: 'fractionne', steps: [
    { step_type: 'interval', repeat_group: 1, repeat_index: 1, target_pace_sec: 243, distance_m: 1000 },
    { step_type: 'recovery', repeat_group: 1, repeat_index: 1, duration_sec: 90 },
    { step_type: 'interval', repeat_group: 1, repeat_index: 2, target_pace_sec: 243, distance_m: 1000 },
    { step_type: 'recovery', repeat_group: 1, repeat_index: 2, duration_sec: 90 },
  ] }
  const [groupe] = lignesStructure(s)
  assert.deepEqual([groupe.nom, groupe.detail, groupe.allure, groupe.tolerance], ['2 × 1000 m', 'récup 1:30 entre chaque', '4:03', '±5 s'])
  assert.deepEqual(groupe.repetitions, [])
})

test('structure : blocs numérotés, récupération seule, sans comparaison un tiret', () => {
  const s = {
    status: 'done', type: 'sortie_longue', analysis: { comparisons: [] },
    steps: [
      { step_type: 'run', target_pace_sec: 330, distance_m: 10000 },
      { step_type: 'recovery', duration_sec: 120 },
      { step_type: 'run', target_pace_sec: 280, distance_m: 5000 },
    ],
  }
  const lignes = lignesStructure(s)
  assert.deepEqual(lignes.map((l) => l.nom), ['Bloc 1', 'Récupération', 'Bloc 2'])
  assert.equal(lignes[0].realise, '-')
  assert.equal(lignes[1].allure, '')
  assert.equal(lignesStructure({ ...s, steps: [s.steps[0]], type: 'facile' })[0].nom, 'Endurance')
  assert.equal(lignesStructure({ ...s, steps: [s.steps[0]] })[0].nom, 'Sortie longue')
})

test('graphe par étape : durée et allure depuis les laps, durée estimée sinon', () => {
  const etapes = etapesGraphe(faite)
  assert.equal(etapes[5].duree, 17)
  assert.equal(Math.round(etapes[5].realise), 402)
  assert.equal(etapes[2].cible, null)
  const prevues = etapesGraphe(tempo)
  assert.deepEqual(prevues.map((e) => [e.duree, e.realise, e.genre]), [[900, null, 'calme'], [1200, null, 'effort'], [600, null, 'calme']])
})

test('graphe par km : cible de l\'étape couvrante', () => {
  assert.equal(etapeDuKm(tempo.steps, 1), 0)
  assert.equal(etapeDuKm(tempo.steps, 4), 1)
  assert.equal(etapeDuKm(tempo.steps, 99), 2)
  const s = { ...tempo, km_laps: [{ duration_sec: 348, avg_pace_sec: 348 }, { duration_sec: 350, avg_pace_sec: 350 }, { duration_sec: 340, avg_pace_sec: 340 }, { duration_sec: 252, avg_pace_sec: 252 }] }
  const km = etapesKm(s)
  assert.deepEqual([km[0].cible, km[3].cible], [350, 254])
})

test('ligne du km touché, avec et sans cible', () => {
  assert.equal(ligneKm({ realise: 348, cible: 350 }, 2), 'Km 3 · 5:48 /km · cible 5:50 · -2 s')
  assert.equal(ligneKm({ realise: 348, cible: null }, 2), 'Km 3 · 5:48 /km')
  assert.equal(ligneKm({ realise: null, cible: 350 }, 0), 'Km 1')
})

test('graphe : graduations, bandes et réalisé coupé sans valeur', () => {
  const g = graphe(etapesGraphe(tempo))
  assert.equal(g.vide, false)
  assert.deepEqual(g.graduations.map((t) => t.libelle), ['0', '15', '30', '45 min'])
  assert.equal(g.bandes.length, 3)
  assert.deepEqual(g.bandes.map((b) => b.genre), ['calme', 'effort', 'calme'])
  assert.equal(g.reel.length, 0)
  // Rapide en haut : la cible tempo est au-dessus de l'échauffement.
  assert.ok(g.bandes[1].cy < g.bandes[0].cy)
  const r = graphe([
    { duree: 60, cible: 300, tolerance: 5, genre: 'effort', realise: 300 },
    { duree: 60, cible: null, tolerance: 5, genre: 'recup', realise: null },
    { duree: 60, cible: 300, tolerance: 5, genre: 'effort', realise: 290 },
  ])
  assert.equal(r.reel.length, 2)
  assert.equal(r.bandes.length, 2)
})

test('graphe : graduations de 30 min au-delà de 75 min', () => {
  const g = graphe([{ duree: 100 * 60, cible: 330, tolerance: 10, genre: 'effort', realise: null }])
  assert.deepEqual(g.graduations.map((t) => t.libelle), ['0', '30', '60', '100 min'])
})

test('graphe vide sans allure', () => {
  assert.equal(graphe([{ duree: 600, cible: null, tolerance: 5, genre: 'recup', realise: null }]).vide, true)
  assert.equal(graphe([]).vide, true)
})
