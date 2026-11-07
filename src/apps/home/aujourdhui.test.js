import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dateDuJour, semainesDu, prochaineSeance, widgetSeance, jourDeMarque, widgetSemaine, vueCourse, bandeRenfo,
} from './aujourdhui.js'

// Plan en cours, semaine 5 du lun 2 au dim 8 nov, semaine 6 du lun 9 au dim 15 nov.
const plan = { id: 'p', status: 'active', race_date: '2026-12-20', race_distance_m: 10000 }
const weeks = [
  { id: 'w5', week_number: 5, start_date: '2026-11-02' },
  { id: 'w6', week_number: 6, start_date: '2026-11-09' },
]
const ef = (dist = 8000) => [{ step_type: 'run', target_pace_sec: 345, distance_m: dist }]
const reps = [
  { step_type: 'warmup', target_pace_sec: 350, duration_sec: 900 },
  { step_type: 'interval', repeat_group: 1, repeat_index: 1, target_pace_sec: 243, distance_m: 1000 },
  { step_type: 'recovery', repeat_group: 1, repeat_index: 1, duration_sec: 90 },
  { step_type: 'interval', repeat_group: 1, repeat_index: 2, target_pace_sec: 243, distance_m: 1000 },
  { step_type: 'recovery', repeat_group: 1, repeat_index: 2, duration_sec: 90 },
  { step_type: 'cooldown', target_pace_sec: 355, duration_sec: 600 },
]
const seance = (o) => ({ status: 'planned', analysis: null, actual_laps: null, ...o })
const s5 = () => [
  seance({ id: 'a5', week_id: 'w5', zone: 'A', type: 'facile', title: 'Endurance fondamentale', scheduled_date: '2026-11-02', status: 'done', completed_at: '2026-11-02T18:00:00', steps: ef(), agg_distance_m: 8000 }),
  seance({ id: 'b5', week_id: 'w5', zone: 'B', type: 'fractionne', title: '6x1000m', scheduled_date: '2026-11-04', status: 'done', completed_at: '2026-11-05T18:00:00', steps: reps, agg_distance_m: 11200 }),
  seance({ id: 'c5', week_id: 'w5', zone: 'C', type: 'sortie_longue', title: 'Sortie longue 16 km', scheduled_date: '2026-11-07', steps: ef(16000), agg_distance_m: 16000 }),
]
const s6 = () => [
  seance({ id: 'a6', week_id: 'w6', zone: 'A', type: 'facile', title: 'Endurance', scheduled_date: '2026-11-09', steps: ef(), agg_distance_m: 8000 }),
  seance({ id: 'b6', week_id: 'w6', zone: 'B', type: 'tempo', title: 'Tempo', scheduled_date: '2026-11-11', steps: ef(10000), agg_distance_m: 10000 }),
  seance({ id: 'c6', week_id: 'w6', zone: 'C', type: 'sortie_longue', title: 'SL', scheduled_date: '2026-11-14', steps: ef(19300), agg_distance_m: 19300 }),
]
const vue = (sessions, aujourdhui = '2026-11-07', w = weeks) => widgetSeance({ plan, weeks: w, sessions, aujourdhui })

test('date du titre', () => {
  assert.equal(dateDuJour('2026-11-07'), 'sam 7 nov')
})

test('semaine en cours et suivante', () => {
  assert.equal(semainesDu(weeks, '2026-11-07').courante.id, 'w5')
  assert.equal(semainesDu(weeks, '2026-11-07').suivante.id, 'w6')
  assert.equal(semainesDu(weeks, '2026-11-10').courante.id, 'w6')
  assert.equal(semainesDu(weeks, '2026-11-10').suivante, null)
})

test('séance du jour : créneau ouvert, « d\'ici dimanche », structure et durée', () => {
  const w = vue([...s5(), ...s6()])
  assert.equal(w.etat, 'duJour')
  assert.equal(w.libelle, 'Séance du jour')
  assert.equal(w.zone, 'longue')
  assert.equal(w.valeur, 'SL 16 km')
  assert.equal(w.sousLigne, 'à 5:45 /km, d\'ici dimanche')
  assert.equal(w.bas.duree, '≈ 92 min')
  assert.equal(w.bas.segments.length, 1)
  assert.equal(w.sessionId, 'c5')
})

test('séance du jour : « dernier jour » et sans allure', () => {
  const w = vue([...s5(), ...s6()], '2026-11-08')
  assert.equal(w.sousLigne, 'à 5:45 /km, dernier jour')
  const sansAllure = s5().map((s) => (s.id === 'c5' ? { ...s, steps: [{ step_type: 'run', duration_sec: 3600 }] } : s))
  assert.equal(vue(sansAllure).sousLigne, 'd\'ici dimanche')
})

test('séance du jour : jour de course', () => {
  const course = [seance({ id: 'r', week_id: 'w5', zone: 'C', type: 'sortie_longue', title: 'COURSE : PR 10k', scheduled_date: '2026-11-07', steps: ef(10000), agg_distance_m: 10000 })]
  const w = widgetSeance({ plan: { ...plan, race_date: '2026-11-07' }, weeks, sessions: course, aujourdhui: '2026-11-07' })
  assert.equal(w.libelle, 'Course')
  assert.equal(w.valeur, '10 km')
  assert.equal(w.zone, 'longue')
})

test('faite aujourd\'hui avant créneau ouvert : km, allure, durée et verdict', () => {
  const sessions = s5().map((s) => (s.id === 'c5'
    ? { ...s, status: 'done', completed_at: '2026-11-07T10:00:00', analysis: { verdict: 'reussie' }, actual_laps: [{ distance_m: 7900, duration_sec: 2756 }] }
    : s))
  // Une autre séance à faire au créneau ouvert ne passe pas devant.
  sessions.push(seance({ id: 'x', week_id: 'w5', zone: 'C', type: 'facile', title: 'Autre', scheduled_date: '2026-11-08', steps: ef() }))
  const w = vue(sessions)
  assert.equal(w.etat, 'faite')
  assert.equal(w.libelle, 'Séance faite')
  assert.equal(w.valeur, '7,9 km')
  assert.equal(w.sousLigne, '5:49 /km · 45:56')
  assert.deepEqual(w.bas, { verdict: 'Séance réussie', titre: 'Sortie longue 16 km' })
  assert.equal(w.sessionId, 'c5')
})

test('faite aujourd\'hui sans laps ni analyse', () => {
  const sessions = s5().map((s) => (s.id === 'c5' ? { ...s, status: 'done', completed_at: '2026-11-07T10:00:00' } : s))
  const w = vue(sessions)
  assert.deepEqual([w.valeur, w.sousLigne, w.bas.verdict], ['SL 16 km', 'Faite', 'Faite'])
})

test('semaine terminée, avec la semaine prochaine', () => {
  const sessions = [...s5().map((s) => (s.id === 'c5' ? { ...s, status: 'done', completed_at: '2026-11-06T10:00:00' } : s)), ...s6()]
  const w = vue(sessions)
  assert.equal(w.etat, 'terminee')
  assert.equal(w.zone, null)
  assert.equal(w.valeur, '3 sur 3')
  assert.equal(w.sousLigne, 'séances faites')
  assert.deepEqual(w.bas, { titre: 'Semaine prochaine', texte: 'S6 · 37,3 km prévus' })
})

test('semaine terminée en dernière semaine du plan : pas de ligne du bas', () => {
  const sessions = s5().map((s) => (s.id === 'c5' ? { ...s, status: 'done', completed_at: '2026-11-06T10:00:00' } : s))
  const w = vue(sessions, '2026-11-07', [weeks[0]])
  assert.equal(w.etat, 'terminee')
  assert.equal(w.bas, null)
})

test('sautée au créneau ouvert avant repos, puis la prochaine', () => {
  // La qualité de mercredi n'a pas été faite : la semaine n'est pas terminée.
  const sessions = [...s5().map((s) => (s.id === 'c5' ? { ...s, status: 'skipped' } : s.id === 'b5' ? { ...s, status: 'planned', completed_at: null } : s)), ...s6()]
  const w = vue(sessions)
  assert.equal(w.etat, 'sautee')
  assert.equal(w.barree, true)
  assert.equal(w.valeur, 'SL 16 km')
  assert.equal(w.sousLigne, 'Créneau Sam-Dim')
  assert.deepEqual(w.bas, { titre: 'Prochaine', prochaine: { zone: 'facile', titre: 'EF 8 km', quand: 'dès lun 9' } })
})

test('repos : rien au créneau ouvert, prochaine « demain »', () => {
  // Mardi 3 nov : facile faite lundi, qualité à partir de mercredi.
  const sessions = s5().map((s) => (s.id === 'b5' ? { ...s, status: 'planned', completed_at: null } : s))
  const w = vue(sessions, '2026-11-03')
  assert.equal(w.etat, 'repos')
  assert.equal(w.valeur, 'Repos')
  assert.equal(w.sousLigne, 'Rien de prévu aujourd\'hui')
  assert.deepEqual(w.bas.prochaine, { zone: 'qualite', titre: '2 × 1000 m', quand: 'demain' })
})

test('repos sans prochaine séance', () => {
  // Mercredi, la facile de lundi n'a pas été faite, plus rien à venir.
  const w = vue([{ ...s5()[0], status: 'planned', completed_at: null }], '2026-11-04', [weeks[0]])
  assert.equal(w.etat, 'repos')
  assert.equal(w.bas, null)
  assert.equal(prochaineSeance([], plan, '2026-11-03'), null)
})

test('widget Semaine : km, part, marques au jour réel et au créneau ouvert', () => {
  const sessions = [...s5(), ...s6()]
  const w = widgetSemaine({ plan, weeks, sessions, aujourdhui: '2026-11-07' })
  assert.equal(w.numero, 5)
  assert.equal(w.faits, 19.2)
  assert.equal(w.prevus, 35.2)
  assert.ok(w.part > 0.5 && w.part < 0.6)
  assert.deepEqual(w.jours.map((j) => j.initiale), ['L', 'M', 'M', 'J', 'V', 'S', 'D'])
  assert.deepEqual(w.jours.map((j) => j.marque?.etat ?? null), ['faite', null, null, 'faite', null, 'aFaire', null])
  assert.equal(w.jours[5].aujourdhui, true)
  assert.equal(w.jours[3].marque.zone, 'qualite')
  // Vendredi, la sortie longue reste sur samedi (créneau pas encore ouvert).
  assert.equal(jourDeMarque(sessions[2], '2026-11-06'), '2026-11-07')
  // Dimanche, créneau encore ouvert : marque sur aujourd'hui.
  assert.equal(jourDeMarque(sessions[2], '2026-11-08'), '2026-11-08')
})

test('widget Semaine : sautée à sa date prévue, part plafonnée', () => {
  const sessions = s5().map((s) => (s.id === 'c5' ? { ...s, status: 'skipped' } : s))
  const w = widgetSemaine({ plan, weeks, sessions, aujourdhui: '2026-11-08' })
  assert.equal(w.jours[5].marque.etat, 'sautee')
  const trop = s5().map((s) => ({ ...s, status: 'done', completed_at: `${s.scheduled_date}T10:00:00`, actual_laps: [{ distance_m: 30000, duration_sec: 9000 }] }))
  assert.equal(widgetSemaine({ plan, weeks, sessions: trop, aujourdhui: '2026-11-08' }).part, 1)
})

test('sans plan actif', () => {
  assert.deepEqual(vueCourse({ plan: null, weeks: [], sessions: [], aujourdhui: '2026-11-07' }), { sansPlan: true })
  assert.equal(vueCourse({ plan, weeks, sessions: s5(), aujourdhui: '2026-11-07' }).sansPlan, false)
})

const content = { intensity: 'normale', blocks: [
  { type: 'superset', focus: 'legs', rounds: 3, exercises: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] },
  { type: 'superset', focus: 'quads', rounds: 3, exercises: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] },
  { type: 'superset', focus: 'trunk', rounds: 3, exercises: [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }] },
] }
const suggestion = { intensity: 'normale', supersets: [{ focus: 'legs' }, { focus: 'trunk' }] }

test('bande Renfo : séance créée pas encore faite', () => {
  const b = bandeRenfo({ profile: { frequency: 1 }, done: [], pending: { id: 'r1', title: 'Jambes et tronc', content }, suggestion, aujourdhui: '2026-11-07' })
  assert.equal(b.ligne, 'Renfo · créée, pas encore faite')
  assert.equal(b.titre, 'Jambes et tronc')
  assert.equal(b.detail, 'Normale · 3 supersets')
  assert.equal(b.cible, '/renfo/session/r1')
})

test('bande Renfo : objectif manquant, puis atteint', () => {
  const done = [{ completed_at: '2026-10-20T10:00:00', content }]
  const b = bandeRenfo({ profile: { frequency: 1 }, done, pending: null, suggestion, aujourdhui: '2026-11-07' })
  assert.equal(b.ligne, 'Renfo · 0 sur 1 cette semaine')
  assert.equal(b.titre, 'Jambes et tronc')
  assert.equal(b.detail, 'Jambes et tronc : rien depuis mar 20 oct')
  assert.equal(b.cible, '/renfo')
  const atteint = [{ completed_at: '2026-11-03T10:00:00', content }]
  const a = bandeRenfo({ profile: { frequency: 1 }, done: atteint, pending: null, suggestion, aujourdhui: '2026-11-07' })
  assert.equal(a.ligne, 'Renfo · 1 sur 1 cette semaine')
  assert.equal(a.titre, 'Objectif atteint')
  assert.equal(a.detail, 'Prochaine : Jambes et tronc')
  assert.equal(a.cible, '/renfo')
  assert.equal(a.label, 'Renfo, 1 sur 1 cette semaine, objectif atteint, prochaine : Jambes et tronc')
  assert.equal(bandeRenfo({ profile: null, done, pending: null, suggestion, aujourdhui: '2026-11-07' }), null)
})

test('bande Renfo : plus de séances que l\'objectif', () => {
  const deux = [{ completed_at: '2026-11-03T10:00:00', content }, { completed_at: '2026-11-05T10:00:00', content }]
  const b = bandeRenfo({ profile: { frequency: 1 }, done: deux, pending: null, suggestion, aujourdhui: '2026-11-07' })
  assert.equal(b.ligne, 'Renfo · 2 sur 1 cette semaine')
  assert.equal(b.titre, 'Objectif atteint')
})

test('bande Renfo : sans suggestion possible, objectif atteint puis manquant', () => {
  const vide = { intensity: 'normale', supersets: [] }
  const atteint = [{ completed_at: '2026-11-03T10:00:00', content }]
  const a = bandeRenfo({ profile: { frequency: 1 }, done: atteint, pending: null, suggestion: vide, aujourdhui: '2026-11-07' })
  assert.deepEqual([a.titre, a.detail, a.cible], ['Objectif atteint', null, '/renfo'])
  const m = bandeRenfo({ profile: { frequency: 1 }, done: [], pending: null, suggestion: null, aujourdhui: '2026-11-07' })
  assert.deepEqual([m.ligne, m.titre, m.detail], ['Renfo · 0 sur 1 cette semaine', 'Crée ta prochaine séance', null])
})
