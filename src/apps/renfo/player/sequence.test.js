// Tests du séquenceur du player Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/player/sequence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSequence, lastAnchorBefore, nextWorkStep, PREP_SEC } from './sequence.js'
import {
  BETWEEN_BLOCKS_SEC, TRANSITION_SEC, estimateSessionMinutes,
} from '../../../../supabase/functions/_shared/strength/estimate.ts'

// Séance complète valide : unilatéraux en reps (fente_arriere, mollet_excentrique)
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

test('bloc principal : séries séparées par rest_sec, rest_sec avant l\'exercice suivant', () => {
  const { steps } = buildSequence(SESSION)
  const first = steps.findIndex((s) => s.slug === 'squat_elastique')
  assert.deepEqual(
    steps.slice(first, first + 6).map((s) => [s.kind, s.slug ?? s.duration_sec, s.set ?? null]),
    [
      ['work', 'squat_elastique', 1], ['rest', 90, null],
      ['work', 'squat_elastique', 2], ['rest', 90, null],
      ['work', 'squat_elastique', 3], ['rest', 90, null],
    ],
  )
  assert.equal(steps[first + 6].slug, 'fente_arriere')
})

test('superset : A, transition, B, repos après B sauf au dernier tour', () => {
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
  assert.equal(a.partner, 'planche_laterale')
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
