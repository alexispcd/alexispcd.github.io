import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLES_PREFERENCES, lireReglage, reglagesDepuisPreferences, resoudreSombre } from './apparence.js'

test('lireReglage : valeurs admises gardées', () => {
  assert.equal(lireReglage('theme', 'dark'), 'dark')
  assert.equal(lireReglage('theme', 'light'), 'light')
  assert.equal(lireReglage('theme', 'auto'), 'auto')
  assert.equal(lireReglage('pression', 'agrandit'), 'agrandit')
  assert.equal(lireReglage('retour', 'ressort'), 'ressort')
})

test('lireReglage : valeur inconnue ou absente, défaut', () => {
  assert.equal(lireReglage('theme', null), 'auto')
  assert.equal(lireReglage('theme', 'sepia'), 'auto')
  assert.equal(lireReglage('pression', undefined), 'fond')
  assert.equal(lireReglage('pression', 'grand'), 'fond')
  assert.equal(lireReglage('retour', ''), 'sobre')
})

test('resoudreSombre : auto suit le système, sinon le choix', () => {
  assert.equal(resoudreSombre('auto', true), true)
  assert.equal(resoudreSombre('auto', false), false)
  assert.equal(resoudreSombre('dark', false), true)
  assert.equal(resoudreSombre('light', true), false)
  assert.equal(resoudreSombre('inconnu', true), true)
})

test('reglagesDepuisPreferences : lit les trois clés, ignore les valeurs inconnues', () => {
  assert.deepEqual(CLES_PREFERENCES, ['dark_mode', 'press_style', 'release_style'])
  assert.deepEqual(reglagesDepuisPreferences([
    { key: 'dark_mode', value: 'auto' },
    { key: 'press_style', value: 'agrandit' },
    { key: 'release_style', value: 'bizarre' },
  ]), { theme: 'auto', pression: 'agrandit' })
  assert.deepEqual(reglagesDepuisPreferences([]), {})
  assert.deepEqual(reglagesDepuisPreferences(undefined), {})
})
