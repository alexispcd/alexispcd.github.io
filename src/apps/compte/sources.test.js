import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  capacitesDe, phraseDeconnexion, sourcesAffichees, sourcesAjoutables, titreActions, titreExpiree,
} from './sources.js'

test('titreActions : nom et capacités du catalogue', () => {
  assert.equal(capacitesDe('coros'), 'forme, activités et laps, envoi sur la montre')
  assert.equal(titreActions('coros'), 'Coros · forme, activités et laps, envoi sur la montre')
})

test('titreExpiree', () => {
  assert.equal(
    titreExpiree('coros'),
    'La connexion à Coros a expiré. Reconnecte-la pour retrouver tes activités et envoyer tes séances.',
  )
})

test('phraseDeconnexion : aucun, un, deux plans', () => {
  assert.equal(phraseDeconnexion('coros', []), 'Aucun plan n\'utilise Coros. Ton compte Coros n\'est pas modifié.')
  assert.equal(
    phraseDeconnexion('coros', ['Pr 10k']),
    'Pr 10k utilise Coros. Sans Coros, plus de validation avec tes activités ni d\'envoi sur ta montre. '
      + 'Les séances déjà envoyées y restent et ton compte Coros n\'est pas modifié.',
  )
  assert.match(phraseDeconnexion('coros', ['A', 'B']), /^A et B utilisent Coros\. /)
  assert.match(phraseDeconnexion('coros', ['A', 'B', 'C']), /^A, B et C utilisent Coros\. /)
})

test('sourcesAffichees et sourcesAjoutables', () => {
  assert.deepEqual(sourcesAffichees([]), [])
  assert.deepEqual(sourcesAjoutables([]).map((s) => s.id), ['coros'])
  const statuts = [{ id: 'coros', etat: 'expiree' }, { id: 'inconnue', etat: 'connectee' }]
  assert.deepEqual(sourcesAffichees(statuts).map((s) => [s.id, s.etat]), [['coros', 'expiree']])
  assert.deepEqual(sourcesAjoutables(statuts), [])
})
