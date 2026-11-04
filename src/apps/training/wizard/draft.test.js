// Tests des conditions par étape de l'assistant Training (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDraft, stepRaison, stepValid, todayISODate } from './draft.js'

// Date locale à n jours d'aujourd'hui (ISO yyyy-MM-dd).
const inDays = (n) => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const course = { ...emptyDraft, name: 'Pr 10k', date: inDays(60), distancePreset: 10000 }

const CAS = [
  { step: 0, d: emptyDraft, raison: 'Indique le nom de ta course.' },
  { step: 0, d: { ...emptyDraft, name: '   ' }, raison: 'Indique le nom de ta course.' },
  { step: 0, d: { ...course, date: '' }, raison: 'Choisis une date de course à venir.' },
  { step: 0, d: { ...course, date: todayISODate() }, raison: 'Choisis une date de course à venir.' },
  { step: 0, d: { ...course, date: inDays(-3) }, raison: 'Choisis une date de course à venir.' },
  { step: 0, d: { ...course, distancePreset: null }, raison: 'Indique la distance de ta course.' },
  { step: 0, d: { ...course, distancePreset: 'custom', distanceCustomM: '' }, raison: 'Indique la distance de ta course.' },
  { step: 0, d: { ...course, startChoice: 'custom', startCustom: inDays(-1) }, raison: 'Choisis un début entre aujourd\'hui et la course.' },
  { step: 0, d: { ...course, startChoice: 'custom', startCustom: inDays(61) }, raison: 'Choisis un début entre aujourd\'hui et la course.' },
  { step: 0, d: course, raison: null },
  { step: 0, d: { ...course, distancePreset: 'custom', distanceCustomM: '15000', startChoice: 'monday' }, raison: null },
  { step: 1, d: emptyDraft, raison: 'Indique ta VMA, entre 10 et 25 km/h.' },
  { step: 1, d: { ...emptyDraft, vmaKmh: '9.9' }, raison: 'Indique ta VMA, entre 10 et 25 km/h.' },
  { step: 1, d: { ...emptyDraft, vmaKmh: 'abc' }, raison: 'Indique ta VMA, entre 10 et 25 km/h.' },
  { step: 1, d: { ...emptyDraft, vmaKmh: '26' }, raison: 'Indique ta VMA, entre 10 et 25 km/h.' },
  { step: 1, d: { ...emptyDraft, vmaKmh: '17.5' }, raison: null },
  { step: 2, d: emptyDraft, raison: null },
  { step: 3, d: emptyDraft, raison: null },
]

test('stepRaison donne la première condition non remplie', () => {
  for (const { step, d, raison } of CAS) {
    assert.equal(stepRaison(step, d), raison, `étape ${step}, ${JSON.stringify(d)}`)
  }
})

test('stepRaison est nul exactement quand stepValid est vrai', () => {
  for (const { step, d } of CAS) {
    assert.equal(stepRaison(step, d) === null, stepValid(step, d), `étape ${step}, ${JSON.stringify(d)}`)
  }
})
