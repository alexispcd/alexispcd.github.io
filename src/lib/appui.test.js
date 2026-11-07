import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VARIANTES, VARIANTE_DEFAUT, libelleVariante, lireVariante, variablesAppui } from './appui.js'

test('lireVariante : variante connue gardée, sinon A', () => {
  assert.equal(lireVariante('C'), 'C')
  assert.equal(lireVariante(null), 'A')
  assert.equal(lireVariante('E'), 'A')
  assert.equal(lireVariante('toString'), 'A')
  assert.equal(VARIANTE_DEFAUT, 'A')
})

test('variante A : valeurs actuelles du thème', () => {
  assert.deepEqual(VARIANTES.A, { objet: 0.14, ligne: 0.06, entree: 100, delai: 0, sortie: 200 })
})

test('variablesAppui : variables CSS de la variante', () => {
  assert.deepEqual(variablesAppui('D'), {
    '--appui-objet': '0.08',
    '--appui-ligne': '0.04',
    '--appui-entree': '150ms',
    '--appui-delai': '120ms',
    '--appui-sortie': '300ms',
  })
  assert.equal(variablesAppui('x')['--appui-objet'], '0.14')
})

test('libelleVariante : en clair', () => {
  assert.equal(libelleVariante('A'), 'A : 14 % et 6 %, sans délai')
  assert.equal(libelleVariante('B'), 'B : 8 % et 4 %, sans délai')
  assert.equal(libelleVariante('C'), 'C : 8 % et 4 %, 80 ms de délai')
  assert.equal(libelleVariante('D'), 'D : 8 % et 4 %, 120 ms de délai')
})
