// Tests du séquenceur du player Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/player/sequence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockProgress, buildSequence, lastAnchorBefore, nextWorkStep, PREP_SEC, stepSeconds, upcomingWork,
} from './sequence.js'
import {
  BETWEEN_BLOCKS_SEC, TRANSITION_SEC, estimateSessionMinutes,
} from '../../../../supabase/functions/_shared/strength/estimate.ts'

// Ancienne séance (bloc principal et supersets A+B) : unilatéraux en reps (fente_arriere, mollet_excentrique)
// et en durée (planche_laterale, etirement_mollet_mur), bande, barre.
const SESSION = {
  title: 'Jambes et tronc',
  estimated_min: 0,
  blocks: [
    { type: 'warmup', items: [
      { slug: 'cercles_hanche', reps: 8 },
      { slug: 'balancements_jambe', reps: 10 },
      { slug: 'marche_laterale', reps: 12, band_kg: 10 },
    ] },
    { type: 'main', items: [
      { slug: 'squat_elastique', sets: 3, reps: 12, rest_sec: 90, band_kg: 20 },
      { slug: 'fente_arriere', sets: 2, reps: 8, rest_sec: 60 },
    ] },
    { type: 'superset', rounds: 3, rest_sec: 75,
      a: { slug: 'pont_fessier_unipodal', reps: 10 },
      b: { slug: 'planche_laterale', duration_sec: 30 } },
    { type: 'superset', rounds: 2, rest_sec: 60,
      a: { slug: 'mollet_excentrique', reps: 8 },
      b: { slug: 'dead_bug', reps: 10 } },
    { type: 'cooldown', items: [
      { slug: 'etirement_flechisseurs', duration_sec: 40 },
      { slug: 'etirement_mollet_mur', duration_sec: 30 },
      { slug: 'posture_enfant', duration_sec: 45 },
    ] },
  ],
}

const works = (steps) => steps.filter((s) => s.kind === 'work')

test('séance complète : sas de préparation, puis travail et repos alternés', () => {
  const { steps } = buildSequence(SESSION)
  assert.equal(steps[0].kind, 'prep')
  assert.equal(steps[0].duration_sec, PREP_SEC)
  assert.equal(steps[1].kind, 'work')
  assert.equal(steps[1].slug, 'cercles_hanche')
  steps.forEach((s, i) => assert.equal(s.index, i))
  // Jamais deux repos consécutifs.
  for (let i = 1; i < steps.length; i++) {
    assert.ok(!(steps[i].kind === 'rest' && steps[i - 1].kind === 'rest'), `repos consécutifs en ${i}`)
  }
})

test('aucun repos en fin de séance', () => {
  const { steps } = buildSequence(SESSION)
  assert.equal(steps.at(-1).kind, 'work')
  assert.equal(steps.at(-1).slug, 'posture_enfant')
})

test('unilatéral : deux steps gauche puis droite, sans repos entre les deux', () => {
  const { steps } = buildSequence(SESSION)
  // Reps (cercles_hanche) et durée (planche_laterale).
  for (const slug of ['cercles_hanche', 'planche_laterale']) {
    const i = steps.findIndex((s) => s.slug === slug)
    assert.equal(steps[i].side, 'gauche')
    assert.equal(steps[i + 1].slug, slug)
    assert.equal(steps[i + 1].side, 'droite')
  }
  const dead = works(steps).filter((s) => s.slug === 'dead_bug')
  assert.ok(dead.every((s) => s.side === null))
})

test('modes : reps en avancée manuelle, durée en décompte', () => {
  const { steps } = buildSequence(SESSION)
  const squat = steps.find((s) => s.slug === 'squat_elastique')
  assert.equal(squat.advance, 'manual')
  assert.equal(squat.reps, 12)
  assert.equal(squat.band_kg, 20)
  const plank = steps.find((s) => s.slug === 'planche_laterale')
  assert.equal(plank.advance, 'auto')
  assert.equal(plank.duration_sec, 30)
})

test('bloc principal : séries séparées par rest_sec, rest_sec avant l\'exercice suivant, série portée par le repos', () => {
  const { steps } = buildSequence(SESSION)
  const first = steps.findIndex((s) => s.slug === 'squat_elastique')
  assert.deepEqual(
    steps.slice(first, first + 6).map((s) => [s.kind, s.slug ?? s.duration_sec, s.set ?? null]),
    [
      ['work', 'squat_elastique', 1], ['rest', 90, 1],
      ['work', 'squat_elastique', 2], ['rest', 90, 2],
      ['work', 'squat_elastique', 3], ['rest', 90, 3],
    ],
  )
  assert.equal(steps[first + 6].slug, 'fente_arriere')
})

test('ancien superset A+B : A, transition, B, repos après B sauf au dernier tour', () => {
  const { steps } = buildSequence(SESSION)
  // Le repos entre blocs porte l'index du bloc qui suit : il ouvre la liste.
  const [blockRest, ...ss] = steps.filter((s) => s.blockIndex === 3)
  assert.equal(blockRest.restType, 'block')
  const pattern = ss.map((s) => (s.kind === 'work' ? `${s.role}${s.round}` : `rest:${s.restType}:${s.duration_sec}`))
  // mollet_excentrique est unilatéral : deux steps A par tour.
  assert.deepEqual(pattern, [
    'A1', 'A1', `rest:transition:${TRANSITION_SEC}`, 'B1', 'rest:round:60',
    'A2', 'A2', `rest:transition:${TRANSITION_SEC}`, 'B2',
  ])
  const a = steps.find((s) => s.role === 'A' && s.blockIndex === 2)
  assert.equal(a.blockLabel, 'Superset 1')
  assert.deepEqual(a.roles, ['A', 'B'])
  assert.equal(a.roundCount, 3)
})

test('BETWEEN_BLOCKS_SEC entre deux blocs', () => {
  const { steps } = buildSequence(SESSION)
  const lastWarmup = steps.findLastIndex((s) => s.blockIndex === 0 && s.kind === 'work')
  assert.equal(steps[lastWarmup + 1].kind, 'rest')
  assert.equal(steps[lastWarmup + 1].duration_sec, BETWEEN_BLOCKS_SEC)
  assert.equal(steps[lastWarmup + 1].restType, 'block')
})

test('total cohérent avec estimateSessionMinutes à l\'arrondi près', () => {
  const { totalSeconds } = buildSequence(SESSION)
  assert.equal(Math.round(totalSeconds / 60), estimateSessionMinutes(SESSION))
})

test('aperçu : prochain exercice et dernière hauteur de barre', () => {
  const content = {
    blocks: [
      { type: 'warmup', items: [{ slug: 'suspension_scapulaire', reps: 8 }] },
      { type: 'main', items: [{ slug: 'rowing_inverse', sets: 2, reps: 8, rest_sec: 60 }] },
    ],
  }
  const { steps } = buildSequence(content)
  const restIndex = steps.findIndex((s) => s.kind === 'rest')
  assert.equal(lastAnchorBefore(steps, restIndex), 'high')
  assert.equal(nextWorkStep(steps, restIndex).anchor, 'low')
})

test('contenu vide : aucune étape', () => {
  assert.deepEqual(buildSequence({ blocks: [] }), { steps: [], totalSeconds: 0 })
  assert.deepEqual(buildSequence(null), { steps: [], totalSeconds: 0 })
})

// Nouveau corps complet : trois trisets, échauffement et retour au calme courts.
const FULL = {
  title: 'Corps complet',
  estimated_min: 0,
  blocks: [
    { type: 'warmup', items: [
      { slug: 'cercles_hanche', reps: 8 },
      { slug: 'ecartes_elastique', reps: 15, band_kg: 10 },
    ] },
    { type: 'superset', focus: 'legs', rounds: 3, rest_sec: 75,
      a: { slug: 'squat_bulgare', reps: 10 },
      b: { slug: 'sdt_roumain_elastique', reps: 12, band_kg: 20 },
      c: { slug: 'mollet_excentrique', reps: 10 } },
    { type: 'superset', focus: 'upper', rounds: 3, rest_sec: 75,
      a: { slug: 'tractions_assistees', reps: 8, band_kg: 30 },
      b: { slug: 'pompes', reps: 12 },
      c: { slug: 'curl_biceps', reps: 12, band_kg: 15 } },
    { type: 'superset', focus: 'core_runner', rounds: 2, rest_sec: 60,
      a: { slug: 'planche', duration_sec: 45 },
      b: { slug: 'equilibre_unipodal', duration_sec: 30 },
      c: { slug: 'dead_bug', reps: 10 } },
    { type: 'cooldown', items: [
      { slug: 'etirement_flechisseurs', duration_sec: 40 },
      { slug: 'posture_enfant', duration_sec: 45 },
    ] },
  ],
}

// Séance jambes au format actuel.
const LEGS = {
  title: 'Jambes',
  estimated_min: 0,
  blocks: [
    { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }, { slug: 'balancements_jambe', reps: 12 }] },
    { type: 'main', items: [
      { slug: 'squat_bulgare', sets: 3, reps: 10, rest_sec: 90 },
      { slug: 'sdt_roumain_elastique', sets: 3, reps: 12, rest_sec: 90, band_kg: 20 },
    ] },
    { type: 'superset', rounds: 3, rest_sec: 60,
      a: { slug: 'fente_arriere', reps: 10 },
      b: { slug: 'mollet_excentrique', reps: 10 } },
    { type: 'superset', rounds: 3, rest_sec: 60,
      a: { slug: 'step_up', reps: 10 },
      b: { slug: 'pont_fessier_unipodal', reps: 12 } },
    { type: 'cooldown', items: [{ slug: 'pigeon', duration_sec: 40 }, { slug: 'etirement_mollet_mur', duration_sec: 40 }] },
  ],
}

test('triset : A, B, C enchaînés, repos après C sauf au dernier tour', () => {
  const { steps } = buildSequence(FULL)
  const [blockRest, ...ts] = steps.filter((s) => s.blockIndex === 1)
  assert.equal(blockRest.restType, 'block')
  const pattern = ts.map((s) => (s.kind === 'work' ? `${s.role}${s.round}` : `rest:${s.restType}:${s.duration_sec}`))
  const t = `rest:transition:${TRANSITION_SEC}`
  // squat_bulgare et mollet_excentrique sont unilatéraux : deux steps par tour.
  assert.deepEqual(pattern, [
    'A1', 'A1', t, 'B1', t, 'C1', 'C1', 'rest:round:75',
    'A2', 'A2', t, 'B2', t, 'C2', 'C2', 'rest:round:75',
    'A3', 'A3', t, 'B3', t, 'C3', 'C3',
  ])
})

test('triset : rôles, liste des rôles et libellé du bloc', () => {
  const { steps } = buildSequence(FULL)
  const c = steps.find((s) => s.role === 'C' && s.blockIndex === 2)
  assert.equal(c.slug, 'curl_biceps')
  assert.deepEqual(c.roles, ['A', 'B', 'C'])
  assert.equal(c.blockLabel, 'Triset 2 · Haut du corps')
  assert.equal(steps.find((s) => s.blockIndex === 3 && s.kind === 'work').blockLabel, 'Triset 3 · Tronc et coureur')
  assert.equal(steps.at(-1).slug, 'posture_enfant')
})

test('triset sans focus : libellé Triset n', () => {
  const content = { blocks: [{ type: 'superset', rounds: 2, rest_sec: 60,
    a: { slug: 'pompes', reps: 10 }, b: { slug: 'dead_bug', reps: 10 }, c: { slug: 'planche', duration_sec: 30 } }] }
  const { steps } = buildSequence(content)
  assert.equal(steps[1].blockLabel, 'Triset 1')
})

test('séance jambes : bloc principal puis supersets A+B, aucun c', () => {
  const { steps } = buildSequence(LEGS)
  assert.ok(works(steps).every((s) => s.role !== 'C'))
  assert.equal(steps.find((s) => s.blockIndex === 2 && s.kind === 'work').blockLabel, 'Superset 1')
  assert.equal(works(steps).filter((s) => s.slug === 'squat_bulgare').length, 6)
})

test('total cohérent avec estimateSessionMinutes : trisets et séance jambes', () => {
  for (const content of [FULL, LEGS]) {
    const { totalSeconds } = buildSequence(content)
    assert.equal(Math.round(totalSeconds / 60), estimateSessionMinutes(content))
  }
})

test('upcomingWork : prochains exercices avec le repos qui les précède', () => {
  const { steps } = buildSequence(FULL)
  // Sur le côté gauche du squat bulgare (triset 1, tour 1).
  const i = steps.findIndex((s) => s.slug === 'squat_bulgare' && s.side === 'gauche')
  const next = upcomingWork(steps, i, 2)
  // Le côté droit n'est pas compté.
  assert.deepEqual(next.map(({ step }) => step.slug), ['sdt_roumain_elastique', 'mollet_excentrique'])
  assert.equal(next[0].rest.restType, 'transition')
  assert.equal(next[1].step.side, 'gauche')
  // Dernier membre du tour 1 : le suivant est A du tour 2, après le repos du tour.
  const lastC = steps.findIndex((s) => s.slug === 'mollet_excentrique' && s.side === 'droite' && s.round === 1)
  const [first] = upcomingWork(steps, lastC, 1)
  assert.equal(first.step.slug, 'squat_bulgare')
  assert.equal(first.step.round, 2)
  assert.equal(first.rest.duration_sec, 75)
  // Pendant un repos, le repos courant n'est pas répété.
  assert.equal(upcomingWork(steps, lastC + 1, 1)[0].rest, null)
  // Fin de séance.
  assert.deepEqual(upcomingWork(steps, steps.length - 1, 2), [])
})

test('blockProgress : un segment par bloc, poids et fraction faite', () => {
  const { steps, totalSeconds } = buildSequence(FULL)
  const start = blockProgress(steps, 0)
  assert.deepEqual(start.map((s) => s.label), [
    'Échauffement', 'Triset 1 · Jambes', 'Triset 2 · Haut du corps', 'Triset 3 · Tronc et coureur', 'Retour au calme',
  ])
  assert.ok(start.every((s) => s.done === 0))
  assert.equal(start.reduce((sum, s) => sum + s.weight, 0), totalSeconds)
  const warmupWeight = steps.filter((s) => s.blockIndex === 0).reduce((sum, s) => sum + stepSeconds(s), 0)
  assert.equal(start[0].weight, warmupWeight)
  // Au premier step du triset 2 : échauffement et triset 1 faits, la suite à faire.
  const i = steps.findIndex((s) => s.blockIndex === 2 && s.kind === 'work')
  const mid = blockProgress(steps, i)
  assert.deepEqual(mid.map((s) => s.done > 0.999 ? 1 : s.done), [1, 1, mid[2].done, 0, 0])
  assert.ok(mid[2].done > 0 && mid[2].done < 1, 'repos d\'entrée du bloc compté comme fait')
  // Fin : tout est fait.
  assert.ok(blockProgress(steps, steps.length).every((s) => s.done === 1))
})
