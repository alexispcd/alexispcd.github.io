import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireRetourConnexion } from './retourConnexion.js'

test('lireRetourConnexion : sans retour', () => {
  assert.equal(lireRetourConnexion(''), null)
  assert.equal(lireRetourConnexion('?view=history'), null)
  assert.equal(lireRetourConnexion('?source=coros'), null)
  assert.equal(lireRetourConnexion('?connexion=ok'), null)
})

test('lireRetourConnexion : réussite, query vidée', () => {
  assert.deepEqual(lireRetourConnexion('?source=coros&connexion=ok'), { source: 'coros', ok: true, search: '' })
})

test('lireRetourConnexion : échec, le reste de la query est gardé', () => {
  assert.deepEqual(
    lireRetourConnexion('?view=history&source=coros&connexion=echec'),
    { source: 'coros', ok: false, search: '?view=history' },
  )
})
