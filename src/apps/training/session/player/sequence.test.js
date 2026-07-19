// Tests unitaires du séquenceur renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/training/session/player/sequence.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSequence } from './sequence.js'

const kinds = (steps) => steps.map((s) => s.kind)

// La séquence s'ouvre toujours sur le sas de préparation : les assertions de
// forme portent sur la suite.
const afterPrep = (steps) => steps.slice(1)

test('préparation : step auto de 10 s en tête, hors durée totale', () => {
  const { steps, totalSeconds } = buildSequence([
    { theme: 'Gainage', exercises: [{ name: 'Planche', duration_sec: 45, sets: 1, rest_sec: 30 }] },
  ])
  const [prep] = steps
  assert.equal(prep.kind, 'prep')
  assert.equal(prep.advance, 'auto')
  assert.equal(prep.duration_sec, 10)
  assert.equal(prep.exercise, null)
  assert.equal(prep.index, 0)
  // Le sas n'entre pas dans l'estimation (alignée sur l'estimateur renfo.js).
  assert.equal(totalSeconds, 45)
})

test('exercice reps : un step travail manuel par série + repos entre les séries', () => {
  const { steps } = buildSequence([
    { theme: 'Gainage', exercises: [{ name: 'Squats', reps: 12, sets: 3, rest_sec: 30 }] },
  ])
  // prep, puis work, rest, work, rest, work (dernier repos omis).
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work', 'rest', 'work'])
  const work = steps.filter((s) => s.kind === 'work')
  assert.equal(work.length, 3)
  work.forEach((w, i) => {
    assert.equal(w.advance, 'manual')
    assert.equal(w.reps, 12)
    assert.equal(w.setIndex, i + 1)
    assert.equal(w.setCount, 3)
    assert.equal(w.side, null)
    assert.equal(w.exercise.name, 'Squats')
    assert.equal(w.theme, 'Gainage')
  })
})

test('exercice duration : step travail auto avec décompte', () => {
  const { steps } = buildSequence([
    { theme: 'Gainage', exercises: [{ name: 'Planche', duration_sec: 45, sets: 2, rest_sec: 20 }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work'])
  const [w1, rest, w2] = afterPrep(steps)
  assert.equal(w1.advance, 'auto')
  assert.equal(w1.duration_sec, 45)
  assert.equal(w1.side, null)
  assert.equal(rest.kind, 'rest')
  assert.equal(rest.advance, 'auto')
  assert.equal(rest.duration_sec, 20)
  assert.equal(w2.setIndex, 2)
})

test('unilatéral : la duration double en deux steps gauche puis droite, sans repos entre', () => {
  const { steps } = buildSequence([
    { theme: 'Fessiers', exercises: [{ name: 'Fentes', duration_sec: 30, sets: 2, rest_sec: 15, unilateral: true }] },
  ])
  // (gauche, droite, repos) × 2, dernier repos omis.
  assert.deepEqual(kinds(steps), ['prep', 'work', 'work', 'rest', 'work', 'work'])
  assert.deepEqual(steps.filter((s) => s.kind === 'work').map((s) => s.side), [
    'gauche', 'droite', 'gauche', 'droite',
  ])
  // Pas de repos entre les deux côtés d'une même série.
  assert.equal(steps[1].kind, 'work')
  assert.equal(steps[2].kind, 'work')
  // Les deux côtés partagent le même numéro de série.
  assert.equal(steps[1].setIndex, 1)
  assert.equal(steps[2].setIndex, 1)
})

test('reps unilatéral : pas de doublage (spec limite le doublage à duration)', () => {
  const { steps } = buildSequence([
    { theme: 'Fessiers', exercises: [{ name: 'Step-up', reps: 10, sets: 1, rest_sec: 0, unilateral: true }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work'])
  assert.equal(steps[1].side, null)
})

test('le tout dernier repos de la séance est omis, y compris entre exercices', () => {
  const { steps } = buildSequence([
    {
      theme: 'Bloc',
      exercises: [
        { name: 'A', duration_sec: 40, sets: 1, rest_sec: 30 },
        { name: 'B', duration_sec: 40, sets: 1, rest_sec: 30 },
      ],
    },
  ])
  // work(A), rest, work(B) — le repos après B (dernier) est omis.
  assert.deepEqual(kinds(steps), ['prep', 'work', 'rest', 'work'])
  assert.equal(steps.at(-1).exercise.name, 'B')
})

test('repos nul (rest_sec 0/absent) : aucun step de repos inséré', () => {
  const { steps } = buildSequence([
    { theme: 'Bloc', exercises: [{ name: 'A', duration_sec: 30, sets: 3, rest_sec: 0 }] },
  ])
  assert.deepEqual(kinds(steps), ['prep', 'work', 'work', 'work'])
})

test('index global continu sur toute la séquence', () => {
  const { steps } = buildSequence([
    { theme: 'Bloc', exercises: [{ name: 'A', reps: 10, sets: 2, rest_sec: 15 }] },
  ])
  assert.deepEqual(steps.map((s) => s.index), [0, 1, 2, 3])
})

test('durée totale : travail (reps × 3s, duration) + repos', () => {
  // 2 séries de planche 45s, repos 20s (1 seul repos) → 45 + 20 + 45 = 110.
  const dur = buildSequence([
    { theme: 'B', exercises: [{ name: 'Planche', duration_sec: 45, sets: 2, rest_sec: 20 }] },
  ])
  assert.equal(dur.totalSeconds, 110)

  // 3 séries de 12 reps (× 3s = 36s), repos 30s × 2 → 36×3 + 30×2 = 168.
  const reps = buildSequence([
    { theme: 'B', exercises: [{ name: 'Squats', reps: 12, sets: 3, rest_sec: 30 }] },
  ])
  assert.equal(reps.totalSeconds, 168)

  // Unilatéral : 2 séries × (30 + 30) travail + 1 repos 15 = 120 + 15 = 135.
  const uni = buildSequence([
    { theme: 'B', exercises: [{ name: 'Fentes', duration_sec: 30, sets: 2, rest_sec: 15, unilateral: true }] },
  ])
  assert.equal(uni.totalSeconds, 135)
})

test('entrées vides / invalides : séquence vide, total 0', () => {
  assert.deepEqual(buildSequence(null), { steps: [], totalSeconds: 0 })
  assert.deepEqual(buildSequence([]), { steps: [], totalSeconds: 0 })
  assert.deepEqual(buildSequence([{ theme: 'X', exercises: [] }]), { steps: [], totalSeconds: 0 })
})
