// Tests du mélange du voile sur le fond (node:test, sans dépendance).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { couleurVoileSurFond, melanger } from './barreEtat.js'
import { colors } from '../styles/tokens.js'

test('melanger : bornes et cas simples', () => {
  assert.equal(melanger('#000000', 1, '#FFFFFF'), '#000000')
  assert.equal(melanger('#000000', 0, '#FFFFFF'), '#FFFFFF')
  assert.equal(melanger('#000000', 0.5, '#FFFFFF'), '#808080')
  assert.equal(melanger('#ff0000', 0.5, '#0000ff'), '#800080')
})

test('voile sur bg en clair : #A5A7A6', () => {
  assert.equal(couleurVoileSurFond('light'), '#A5A7A6')
})

test('voile sur bg en sombre : bg lui-même', () => {
  assert.equal(couleurVoileSurFond('dark'), '#0F1112')
  assert.equal(couleurVoileSurFond('dark'), colors.dark.bg)
})
