// Tests unitaires du séquenceur renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/training/session/player/sequence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSequence } from './sequence.js'
import {
  estimateStrengthDuration, PER_REP_SEC, REST_BETWEEN_EXERCISES_SEC, REST_BETWEEN_ROUNDS_SEC,
} from '../renfo.js'

// Repos lus depuis l'estimateur (source unique) : le test suit leurs valeurs.
const EXO = REST_BETWEEN_EXERCISES_SEC
const ROUND = REST_BETWEEN_ROUNDS_SEC

const kinds = (steps) => steps.map((s) => s.kind)

// La séquence s'ouvre toujours sur le sas de préparation : les assertions de
// forme portent sur la suite.
const afterPrep = (steps) => steps.slice(1)

// ── Sas de préparation ────────────────────────────────────────────────────────
test('préparation : step auto de 10 s en tête, hors durée totale', () => {
  const { steps, totalSeconds } = buildSequence([
    { theme: 'Gainage', rounds: 2, exercises: [{ name: 'Planche', duration_sec: 45 }] },
  ])
  const [prep] = steps
  assert.equal(prep.kind, 'prep')
  assert.equal(prep.advance, 'auto')
  assert.equal(prep.duration_sec, 10)
  assert.equal(prep.exercise, null)
  assert.equal(prep.index, 0)
  // Le sas n'entre pas dans l'estimation (alignée sur l'estimateur renfo.js).
  // 2 tours de 45 s + 1 repos inter-tours.
  assert.equal(totalSeconds, 2 * 45 + ROUND)
})

test('entrées vides / invalides : séquence vide, total 0', () => {
  assert.deepEqual(buildSequence(null), { steps: [], totalSeconds: 0 })
  assert.deepEqual(buildSequence([]), { steps: [], totalSeconds: 0 })
  assert.deepEqual(buildSequence([{ theme: 'X', rounds: 2, exercises: [] }]), { steps: [], totalSeconds: 0 })
})

// ── Circuit ───────────────────────────────────────────────────────────────────
test('circuit : le bloc entier est répété, repos inter-exercices puis inter-tours', () => {
  const { steps } = buildSequence([
    {
      theme: 'Force',
      rounds: 2,
      exercises: [
        { name: 'Planche', duration_sec: 40 },
        { name: 'Fentes', reps: 10 },
      ],
    },
  ])
  // Tour 1 : A, repos inter-exercices, B, puis repos inter-tours, puis Tour 2 : A, repos, B.
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work'])
  const [a1, rExo, b1, rRound, a2] = afterPrep(steps)
  assert.equal(a1.exercise.name, 'Planche')
  assert.equal(rExo.duration_sec, EXO)
  assert.equal(b1.exercise.name, 'Fentes')
  assert.equal(rRound.duration_sec, ROUND)
  assert.equal(a2.exercise.name, 'Planche')
  // Pas de repos après le dernier exercice du dernier tour.
  assert.equal(steps.at(-1).kind, 'work')
})

test('circuit : deux blocs, tours différents, unilatéral en reps dédoublé', () => {
  const blocks = [
    {
      theme: 'Force',
      rounds: 2,
      exercises: [
        { name: 'Planche', duration_sec: 40 },
        { name: 'Step-up', reps: 10, unilateral: true },
      ],
    },
    { theme: 'Gainage', rounds: 3, exercises: [{ name: 'Hollow', duration_sec: 30 }] },
  ]
  const { steps, totalSeconds } = buildSequence(blocks)

  // Ordre exact : l'unilatéral produit deux steps accolés, sans repos entre les
  // côtés ; le repos inter-tours sépare les tours ET les deux blocs.
  assert.deepEqual(kinds(steps), [
    'prep',
    'work', 'rest', 'work', 'work', // bloc 1 tour 1 : Planche, repos, Step-up G, Step-up D
    'rest', // repos inter-tours
    'work', 'rest', 'work', 'work', // bloc 1 tour 2
    'rest', // repos inter-blocs
    'work', 'rest', 'work', 'rest', 'work', // bloc 2, 3 tours séparés par le repos inter-tours
  ])

  const rests = steps.filter((s) => s.kind === 'rest').map((s) => s.duration_sec)
  assert.deepEqual(rests, [EXO, ROUND, EXO, ROUND, ROUND, ROUND])

  // Côtés et numéros de tour.
  const stepUps = steps.filter((s) => s.exercise?.name === 'Step-up')
  assert.deepEqual(stepUps.map((s) => s.side), ['gauche', 'droite', 'gauche', 'droite'])
  assert.deepEqual(stepUps.map((s) => s.roundIndex), [1, 1, 2, 2])
  stepUps.forEach((s) => {
    assert.equal(s.roundCount, 2)
    assert.equal(s.advance, 'manual')
    assert.equal(s.reps, 10)
    // Le format circuit ne porte plus de séries.
    assert.equal(s.setIndex, undefined)
  })

  const hollow = steps.filter((s) => s.exercise?.name === 'Hollow')
  assert.deepEqual(hollow.map((s) => s.roundIndex), [1, 2, 3])
  assert.equal(hollow[0].roundCount, 3)
  assert.equal(hollow[0].theme, 'Gainage')

  // La durée du séquenceur colle exactement à l'estimateur.
  // Bloc 1 : 2 tours de (Planche 40 s, repos, Step-up 10 reps par côté), repos inter-tours.
  // Bloc 2 : 3 tours de Hollow 30 s séparés par le repos inter-tours. Puis le repos inter-blocs.
  const bloc1 = 2 * (40 + EXO + 2 * 10 * PER_REP_SEC) + ROUND
  const bloc2 = 3 * 30 + 2 * ROUND
  assert.equal(totalSeconds, bloc1 + bloc2 + ROUND)
  assert.equal(Math.round(totalSeconds / 60), estimateStrengthDuration(blocks))
})

test('circuit : unilatéral en duration dédoublé aussi', () => {
  const { steps } = buildSequence([
    { theme: 'Gainage', rounds: 2, exercises: [{ name: 'Copenhague', duration_sec: 20, unilateral: true }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'work', 'rest', 'work', 'work'])
  assert.deepEqual(steps.filter((s) => s.kind === 'work').map((s) => s.side), [
    'gauche', 'droite', 'gauche', 'droite',
  ])
  // Les deux côtés partagent le même tour.
  assert.equal(steps[1].roundIndex, 1)
  assert.equal(steps[2].roundIndex, 1)
})

test('circuit : index global continu sur toute la séquence', () => {
  const { steps } = buildSequence([
    { theme: 'Bloc', rounds: 2, exercises: [{ name: 'A', reps: 10 }] },
  ])
  assert.deepEqual(steps.map((s) => s.index), [0, 1, 2, 3])
})

// ── Blocs historiques (plans générés avant le format circuit) ────────────────
test('hérité : un step travail par série + repos rest_sec entre les séries', () => {
  const { steps } = buildSequence([
    { theme: 'Gainage', exercises: [{ name: 'Squats', reps: 12, sets: 3, rest_sec: 30 }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work', 'rest', 'work'])
  const work = steps.filter((s) => s.kind === 'work')
  work.forEach((w, i) => {
    assert.equal(w.advance, 'manual')
    assert.equal(w.setIndex, i + 1)
    assert.equal(w.setCount, 3)
    assert.equal(w.roundIndex, undefined)
  })
  assert.equal(steps[2].duration_sec, 30)
})

test('hérité : unilatéral dédoublé en duration seulement', () => {
  const uni = buildSequence([
    { theme: 'F', exercises: [{ name: 'Fentes', duration_sec: 30, sets: 2, rest_sec: 15, unilateral: true }] },
  ])
  assert.deepEqual(kinds(uni.steps), ['prep', 'work', 'work', 'rest', 'work', 'work'])

  const reps = buildSequence([
    { theme: 'F', exercises: [{ name: 'Step-up', reps: 10, sets: 1, rest_sec: 0, unilateral: true }] },
  ])
  assert.deepEqual(kinds(reps.steps), ['prep', 'work'])
  assert.equal(reps.steps[1].side, null)
})

test('hérité : repos nul, et dernier repos de la séance omis', () => {
  const { steps } = buildSequence([
    { theme: 'Bloc', exercises: [{ name: 'A', duration_sec: 30, sets: 3, rest_sec: 0 }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'work', 'work'])

  const two = buildSequence([
    {
      theme: 'Bloc',
      exercises: [
        { name: 'A', duration_sec: 40, sets: 1, rest_sec: 30 },
        { name: 'B', duration_sec: 40, sets: 1, rest_sec: 30 },
      ],
    },
  ])
  assert.deepEqual(kinds(two.steps), ['prep', 'work', 'rest', 'work'])
  assert.equal(two.steps.at(-1).exercise.name, 'B')
})

test('hérité : durée totale alignée sur l\'estimateur', () => {
  const blocks = [{ theme: 'B', exercises: [{ name: 'Planche', duration_sec: 45, sets: 2, rest_sec: 20 }] }]
  // 45 + 20 + 45 = 110.
  assert.equal(buildSequence(blocks).totalSeconds, 110)
})

// ── Mixte ─────────────────────────────────────────────────────────────────────
test('mixte : un bloc circuit et un bloc hérité cohabitent', () => {
  const { steps } = buildSequence([
    { theme: 'Circuit', rounds: 2, exercises: [{ name: 'A', duration_sec: 20 }] },
    { theme: 'Hérité', exercises: [{ name: 'B', duration_sec: 20, sets: 2, rest_sec: 45 }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work', 'rest', 'work', 'rest', 'work'])
  const rests = steps.filter((s) => s.kind === 'rest').map((s) => s.duration_sec)
  // Inter-tours dans le circuit, inter-blocs, puis 45 entre les séries héritées.
  assert.deepEqual(rests, [ROUND, ROUND, 45])
})
