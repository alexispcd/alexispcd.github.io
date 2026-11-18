// Tests de la séance en attente de Modifier (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/session/modifier.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actifs, ajouterExercice, ajouterSuperset, blocEdition, changerTheme, changerTours, contexteDosage, enleverSuperset,
  etatDe, exercicesDe, manques, maxDe, memeSeance, remplacerExercice, retirerExercice, retirerSuperset, seanceDe,
  sousLigneBloc,
} from './modifier.js'

const BANDS = [5, 10, 15, 20, 30]

const content = {
  title: 'Jambes et tronc',
  intensity: 'legere',
  blocks: [
    { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }, { slug: 'balancements_jambe', reps: 12 }] },
    { type: 'superset', focus: 'quads', rounds: 3, rest_sec: 60, exercises: [
      { slug: 'squat_bulgare', reps: 12 }, { slug: 'fente_arriere', reps: 12 }, { slug: 'marche_laterale', reps: 12, band_kg: 10 },
    ] },
    { type: 'superset', focus: 'trunk', rounds: 3, rest_sec: 60, exercises: [
      { slug: 'dead_bug', reps: 12 }, { slug: 'planche', duration_sec: 45 },
    ] },
    { type: 'cooldown', items: [{ slug: 'pigeon', duration_sec: 40 }] },
  ],
}

const ctx = contexteDosage(content, { pompes: { reps: 15 } }, BANDS)

test('etatDe et seanceDe : la séance telle qu\'elle est', () => {
  const etat = etatDe(content)
  assert.deepEqual(seanceDe(etat), {
    warmup: ['cercles_hanche', 'balancements_jambe'],
    supersets: [
      { focus: 'quads', rounds: 3, exercises: [{ slug: 'squat_bulgare' }, { slug: 'fente_arriere' }, { slug: 'marche_laterale' }] },
      { focus: 'trunk', rounds: 3, exercises: [{ slug: 'dead_bug' }, { slug: 'planche' }] },
    ],
    cooldown: ['pigeon'],
  })
  assert.ok(memeSeance(etat, etatDe(content)))
  assert.equal(sousLigneBloc(etat, etat.supersets[0].id), 'Jambes · 3 exercices, 3 tours')
  assert.equal(sousLigneBloc(etat, 'warmup'), 'Cercles de hanche, Balancements de jambe')
  assert.deepEqual(manques(etat), [])
})

test('retirer, ajouter : dose de la base, sinon la référence ; remis à sa place, même séance', () => {
  const etat = etatDe(content)
  const id = etat.supersets[1].id
  const moins = retirerExercice(etat, id, 'planche')
  assert.deepEqual(exercicesDe(moins, id).map((e) => e.slug), ['dead_bug'])
  assert.deepEqual(manques(moins), [{ cle: id, phrase: 'Au moins 2 exercices.' }])
  assert.equal(sousLigneBloc(moins, id), 'Tronc · 1 exercice, 3 tours')
  const plus = ajouterExercice(moins, id, 'pompes', ctx)
  assert.deepEqual(exercicesDe(plus, id).at(-1).dose, { slug: 'pompes', reps: 15 })
  assert.equal(manques(plus).length, 0)
  assert.ok(!memeSeance(plus, etat))
  // Un exercice d'origine remis garde sa dose.
  const remis = ajouterExercice(moins, id, 'planche', ctx)
  assert.deepEqual(exercicesDe(remis, id).at(-1).dose, { slug: 'planche', duration_sec: 45 })
  assert.ok(memeSeance(remis, etat))
})

test('remplacer : élastique de l\'exercice d\'origine, repris d\'un remplacement à l\'autre', () => {
  const etat = etatDe(content)
  const id = etat.supersets[0].id
  const un = remplacerExercice(etat, id, 'marche_laterale', 'squat_elastique', ctx)
  const ex = exercicesDe(un, id)[2]
  assert.equal(ex.remplace, 'marche_laterale')
  assert.equal(ex.dose.band_kg, 10)
  const deux = remplacerExercice(un, id, 'squat_elastique', 'abduction_elastique', ctx)
  assert.equal(exercicesDe(deux, id)[2].remplace, 'marche_laterale')
  assert.equal(exercicesDe(deux, id)[2].dose.band_kg, 10)
  assert.deepEqual(seanceDe(deux).supersets[0].exercises[2], { slug: 'abduction_elastique', remplace: 'marche_laterale' })
  // Échauffement : sans reprise.
  const w = remplacerExercice(etat, 'warmup', 'cercles_hanche', 'ecartes_elastique', ctx)
  assert.equal(w.warmup[0].remplace, null)
  assert.equal(w.warmup[0].dose.band_kg, 15)
})

test('supersets : ajout vide à 3 tours, thème changé vidé, tours gardés, retrait', () => {
  const depart = etatDe(content)
  const etat = changerTours(depart, depart.supersets[0].id, 4)
  const { etat: avec, id } = ajouterSuperset(etat, 'pull')
  assert.equal(actifs(avec).length, 3)
  assert.deepEqual(exercicesDe(avec, id), [])
  assert.equal(avec.supersets.at(-1).rounds, 3)
  assert.equal(blocEdition(avec, id), 2)
  assert.deepEqual(manques(avec).map((m) => m.cle), [id])
  const s1 = avec.supersets[0].id
  const theme = changerTheme(avec, s1, 'pull')
  assert.deepEqual(exercicesDe(theme, s1), [])
  assert.equal(theme.supersets[0].rounds, 4)
  assert.deepEqual(manques(theme).map((m) => m.cle), [s1, id])
  const retire = retirerSuperset(avec, id)
  assert.equal(actifs(retire).length, 2)
  assert.equal(seanceDe(retire).supersets.length, 2)
  assert.equal(enleverSuperset(retire, id).supersets.length, 2)
})

test('échauffement et retour au calme : 1 à 3', () => {
  const etat = etatDe(content)
  assert.equal(maxDe('warmup'), 3)
  assert.equal(maxDe('cooldown'), 3)
  assert.equal(maxDe(etat.supersets[0].id), 4)
  const vide = retirerExercice(etat, 'cooldown', 'pigeon')
  assert.deepEqual(manques(vide), [{ cle: 'cooldown', phrase: 'Au moins 1 exercice.' }])
  assert.equal(blocEdition(vide, 'cooldown'), 'cooldown')
})
