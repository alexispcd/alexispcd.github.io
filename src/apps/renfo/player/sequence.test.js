// Tests du séquenceur du player Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/player/sequence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockProgress, buildSequence, focusStep, lastAnchorBefore, nextWorkStep, PREP_SEC, stepSeconds,
} from './sequence.js'
import { supersetMembers } from '../content.js'
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

// Lettre d'un exercice dans son superset (A, B, C, D), pour lire les motifs.
const lettre = (content, s) => 'ABCD'[supersetMembers(content.blocks[s.blockIndex]).findIndex((d) => d.slug === s.slug)]

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
  const pattern = ss.map((s) => (s.kind === 'work' ? `${lettre(SESSION, s)}${s.round}` : `rest:${s.restType}:${s.duration_sec}`))
  // mollet_excentrique est unilatéral : deux steps A par tour.
  assert.deepEqual(pattern, [
    'A1', 'A1', `rest:transition:${TRANSITION_SEC}`, 'B1', 'rest:round:60',
    'A2', 'A2', `rest:transition:${TRANSITION_SEC}`, 'B2',
  ])
  const a = steps.find((s) => s.slug === 'pont_fessier_unipodal')
  assert.equal(a.heading, 'Superset 1')
  assert.equal(a.rang, 1)
  assert.equal(a.roundCount, 3)
  assert.equal('role' in a, false)
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

// Ancienne séance jambes (bloc principal et supersets A+B), toujours jouée.
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

test('ancien superset a, b, c : enchaînés, repos après c sauf au dernier tour', () => {
  const { steps } = buildSequence(FULL)
  const [blockRest, ...ts] = steps.filter((s) => s.blockIndex === 1)
  assert.equal(blockRest.restType, 'block')
  const pattern = ts.map((s) => (s.kind === 'work' ? `${lettre(FULL, s)}${s.round}` : `rest:${s.restType}:${s.duration_sec}`))
  const t = `rest:transition:${TRANSITION_SEC}`
  // squat_bulgare et mollet_excentrique sont unilatéraux : deux steps par tour.
  assert.deepEqual(pattern, [
    'A1', 'A1', t, 'B1', t, 'C1', 'C1', 'rest:round:75',
    'A2', 'A2', t, 'B2', t, 'C2', 'C2', 'rest:round:75',
    'A3', 'A3', t, 'B3', t, 'C3', 'C3',
  ])
})

test('ancien superset a, b, c : libellé du bloc avec son thème, sans rôle', () => {
  const { steps } = buildSequence(FULL)
  const c = steps.find((s) => s.slug === 'curl_biceps')
  assert.equal(c.heading, 'Superset 2 · Haut du corps')
  assert.equal(c.rang, 2)
  assert.equal(steps.find((s) => s.blockIndex === 3 && s.kind === 'work').heading, 'Superset 3 · Tronc')
  assert.ok(steps.every((s) => !('role' in s) && !('roles' in s)))
  assert.ok(steps.every((s) => !String(s.heading ?? '').includes('Triset')))
  assert.equal(steps.at(-1).slug, 'posture_enfant')
})

test('superset sans thème : libellé Superset n', () => {
  const content = { blocks: [{ type: 'superset', rounds: 2, rest_sec: 60,
    a: { slug: 'pompes', reps: 10 }, b: { slug: 'dead_bug', reps: 10 }, c: { slug: 'planche', duration_sec: 30 } }] }
  const { steps } = buildSequence(content)
  assert.equal(steps[1].heading, 'Superset 1')
})

test('ancienne séance jambes : bloc principal en séries puis supersets a et b', () => {
  const { steps } = buildSequence(LEGS)
  assert.equal(steps.find((s) => s.blockIndex === 2 && s.kind === 'work').heading, 'Superset 1')
  assert.equal(steps.find((s) => s.blockIndex === 1 && s.kind === 'work').heading, 'Bloc principal')
  assert.equal(steps.find((s) => s.blockIndex === 1 && s.kind === 'work').set, 1)
  assert.equal(works(steps).filter((s) => s.slug === 'squat_bulgare').length, 6)
})

test('total cohérent avec estimateSessionMinutes : trisets et séance jambes', () => {
  for (const content of [FULL, LEGS]) {
    const { totalSeconds } = buildSequence(content)
    assert.equal(Math.round(totalSeconds / 60), estimateSessionMinutes(content))
  }
})

test('focusStep : step de travail courant, sinon le prochain', () => {
  const { steps } = buildSequence(FULL)
  assert.equal(focusStep(steps, 0).slug, 'cercles_hanche')
  const transition = steps.findIndex((s) => s.restType === 'transition' && s.blockIndex === 1)
  assert.equal(focusStep(steps, transition).slug, steps[transition + 1].slug)
  const block = steps.findIndex((s) => s.restType === 'block')
  assert.equal(focusStep(steps, block).blockIndex, 1)
  assert.equal(focusStep(steps, steps.length - 1).slug, 'posture_enfant')
  assert.equal(focusStep(steps, steps.length), null)
})

test('blockProgress : un segment par bloc, poids et fraction faite', () => {
  const { steps, totalSeconds } = buildSequence(FULL)
  const start = blockProgress(steps, 0)
  assert.deepEqual(start.map((s) => s.heading), [
    'Échauffement', 'Superset 1 · Jambes', 'Superset 2 · Haut du corps', 'Superset 3 · Tronc', 'Retour au calme',
  ])
  assert.ok(start.every((s) => s.done === 0))
  assert.equal(start.reduce((sum, s) => sum + s.weight, 0), totalSeconds)
  const warmupWeight = steps.filter((s) => s.blockIndex === 0).reduce((sum, s) => sum + stepSeconds(s), 0)
  assert.equal(start[0].weight, warmupWeight)
  // Au premier step du superset 2 : échauffement et superset 1 faits, la suite à faire.
  const i = steps.findIndex((s) => s.blockIndex === 2 && s.kind === 'work')
  const mid = blockProgress(steps, i)
  assert.deepEqual(mid.map((s) => s.done > 0.999 ? 1 : s.done), [1, 1, mid[2].done, 0, 0])
  assert.ok(mid[2].done > 0 && mid[2].done < 1, 'repos d\'entrée du bloc compté comme fait')
  // Fin : tout est fait.
  assert.ok(blockProgress(steps, steps.length).every((s) => s.done === 1))
})

test('séance jambes à trois supersets : libellés des thèmes propres au type', () => {
  const content = {
    blocks: [
      { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }] },
      { type: 'superset', focus: 'quads', rounds: 3, rest_sec: 75,
        a: { slug: 'squat_bulgare', reps: 10 }, b: { slug: 'step_up', reps: 10 }, c: { slug: 'sdt_roumain_elastique', reps: 12, band_kg: 20 } },
      { type: 'superset', focus: 'posterior', rounds: 3, rest_sec: 75,
        a: { slug: 'pont_fessier_unipodal', reps: 12 }, b: { slug: 'abduction_elastique', reps: 15, band_kg: 10 }, c: { slug: 'fente_arriere', reps: 10 } },
      { type: 'superset', focus: 'foot_calf', rounds: 3, rest_sec: 60,
        a: { slug: 'mollet_excentrique', reps: 10 }, b: { slug: 'releves_pointes', reps: 20 }, c: { slug: 'equilibre_unipodal', duration_sec: 30 } },
      { type: 'cooldown', items: [{ slug: 'pigeon', duration_sec: 40 }] },
    ],
  }
  const { steps, totalSeconds } = buildSequence(content)
  const labels = [...new Set(works(steps).map((s) => s.heading))]
  assert.deepEqual(labels, [
    'Échauffement', 'Superset 1 · Quadriceps', 'Superset 2 · Ischios et fessiers', 'Superset 3 · Pied et mollet', 'Retour au calme',
  ])
  assert.equal(Math.round(totalSeconds / 60), estimateSessionMinutes(content))
})

// Nouveau format (lot R1) : supersets en liste d'exercices, de 2 à 4, 1 à 5 tours.
const COMPOSEE = {
  title: 'Jambes et tronc',
  estimated_min: 0,
  intensity: 'normale',
  blocks: [
    { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }] },
    { type: 'superset', focus: 'quads', rounds: 5, rest_sec: 60, exercises: [
      { slug: 'squat_elastique', reps: 15, band_kg: 20 },
      { slug: 'squat_saute', reps: 10 },
      { slug: 'sdt_roumain_elastique', reps: 12, band_kg: 20 },
      { slug: 'dead_bug', reps: 10 },
    ] },
    { type: 'superset', focus: 'trunk', rounds: 1, rest_sec: 60, exercises: [
      { slug: 'planche', duration_sec: 45 },
      { slug: 'pompes', reps: 12 },
    ] },
    { type: 'cooldown', items: [{ slug: 'posture_enfant', duration_sec: 45 }] },
  ],
}

test('superset de 4 exercices sur 5 tours : A, B, C, D, repos après D sauf au dernier tour', () => {
  const { steps } = buildSequence(COMPOSEE)
  const [blockRest, ...ts] = steps.filter((s) => s.blockIndex === 1)
  assert.equal(blockRest.restType, 'block')
  const pattern = ts.map((s) => (s.kind === 'work' ? `${lettre(COMPOSEE, s)}${s.round}` : `rest:${s.restType}:${s.duration_sec}`))
  const t = `rest:transition:${TRANSITION_SEC}`
  const round = (n) => [`A${n}`, t, `B${n}`, t, `C${n}`, t, `D${n}`]
  assert.deepEqual(pattern, [
    ...round(1), 'rest:round:60', ...round(2), 'rest:round:60', ...round(3), 'rest:round:60',
    ...round(4), 'rest:round:60', ...round(5),
  ])
  const d = steps.find((s) => s.slug === 'dead_bug')
  assert.equal(d.heading, 'Superset 1 · Quadriceps')
  assert.equal(d.roundCount, 5)
})

test('superset d\'un seul tour : aucun repos après le dernier tour', () => {
  const { steps } = buildSequence(COMPOSEE)
  const ts = steps.filter((s) => s.blockIndex === 2)
  assert.deepEqual(ts.map((s) => s.kind === 'work' ? `${lettre(COMPOSEE, s)}${s.round}` : `rest:${s.restType}`), [
    'rest:block', 'A1', 'rest:transition', 'B1',
  ])
  assert.ok(!steps.some((s) => s.restType === 'round' && s.blockIndex === 2))
})

test('nouveau format : total cohérent avec estimateSessionMinutes', () => {
  const { totalSeconds } = buildSequence(COMPOSEE)
  assert.equal(Math.round(totalSeconds / 60), estimateSessionMinutes(COMPOSEE))
})
