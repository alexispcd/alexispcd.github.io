// Tests de la détection des erreurs réseau (node:test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { PAS_DE_CONNEXION, estErreurReseau, texteErreur } from './reseau.js'

test('erreurs réseau reconnues', () => {
  assert.equal(estErreurReseau({ network: true }), true)
  assert.equal(estErreurReseau(Object.assign(new Error('Pas de connexion, réessaie.'), { network: true })), true)
  assert.equal(estErreurReseau(new AuthRetryableFetchError('Failed to fetch', 0)), true)
  assert.equal(estErreurReseau(new TypeError('Load failed')), true)
  assert.equal(estErreurReseau(new TypeError('Failed to fetch')), true)
  assert.equal(estErreurReseau(new TypeError('NetworkError when attempting to fetch resource.')), true)
  assert.equal(estErreurReseau(new TypeError('fetch failed')), true)
  // Forme observée sous Node pour une erreur postgrest-js.
  assert.equal(estErreurReseau({ message: 'TypeError: fetch failed', details: 'x', hint: '', code: '' }), true)
})

test('autres erreurs non reconnues', () => {
  assert.equal(estErreurReseau(new TypeError('x is not a function')), false)
  assert.equal(estErreurReseau({ message: 'refusé', code: '42501' }), false)
  assert.equal(estErreurReseau(new Error('Erreur serveur (500)')), false)
  assert.equal(estErreurReseau(new Error('Failed to fetch')), false)
  assert.equal(estErreurReseau({ message: 'fetch failed', code: '42501' }), false)
  assert.equal(estErreurReseau(null), false)
  assert.equal(estErreurReseau(undefined), false)
  assert.equal(estErreurReseau('Failed to fetch'), false)
})

test('texteErreur : phrase ou PAS_DE_CONNEXION, détail en console', (t) => {
  const erreurs = t.mock.method(console, 'error', () => {})
  const phrase = 'La séance n\'a pas pu être sautée. Réessaie.'
  assert.equal(texteErreur(new TypeError('Load failed'), phrase), PAS_DE_CONNEXION)
  assert.equal(texteErreur({ network: true }, phrase), PAS_DE_CONNEXION)
  assert.equal(texteErreur(new Error('Erreur serveur (500)'), phrase), phrase)
  assert.equal(texteErreur({ message: 'refusé', code: '42501' }, phrase), phrase)
  assert.equal(texteErreur(null, phrase), phrase)
  assert.equal(erreurs.mock.callCount(), 5)
})
