// Tests des textes de la page séance Renfo (node:test, sans dépendance).
// Lancement : node --test src/apps/renfo/session/seance.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ligneBloc, ligneDose, ligneEnTete, pastillesExercice, phraseReinitialisation, phraseSuppression, prevu,
  rangSuperset, sousLigneRemplacer, themesSeance, titreBloc, titreRemplacer,
} from './seance.js'
import { titreAffiche } from '../content.js'

// Horodatage d'une heure locale, quel que soit le fuseau de la machine.
const local = (y, m, d, h = 18) => new Date(y, m - 1, d, h).toISOString()

const nouvelle = {
  title: 'Corps complet',
  status: 'planned',
  completed_at: null,
  content: {
    title: 'Corps complet',
    estimated_min: 63,
    intensity: 'normale',
    blocks: [
      { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }, { slug: 'balancements_jambe', reps: 12 }] },
      { type: 'superset', focus: 'legs', rounds: 3, rest_sec: 60, exercises: [
        { slug: 'squat_bulgare', reps: 12 }, { slug: 'fente_arriere', reps: 12 }, { slug: 'mollet_excentrique', reps: 12 },
      ] },
      { type: 'superset', focus: 'pull', rounds: 3, rest_sec: 60, exercises: [
        { slug: 'tractions_assistees', reps: 10, band_kg: 15 }, { slug: 'pompes', reps: 14 }, { slug: 'curl_biceps', reps: 14, band_kg: 10 },
      ] },
      { type: 'superset', focus: 'trunk', rounds: 1, rest_sec: 60, exercises: [{ slug: 'planche', duration_sec: 45 }, { slug: 'dead_bug', reps: 10 }] },
      { type: 'cooldown', items: [{ slug: 'etirement_flechisseurs', duration_sec: 40 }] },
    ],
  },
}

// Ancienne séance de cycle : trisets a, b, c, focus core_runner, bloc principal.
const ancienne = {
  title: 'Corps complet – Semaine 2 (Progression)',
  status: 'done',
  completed_at: local(2026, 10, 24),
  content: {
    title: 'Corps complet – Semaine 2 (Progression)',
    estimated_min: 35,
    blocks: [
      { type: 'warmup', items: [{ slug: 'cercles_hanche', reps: 8 }] },
      { type: 'main', items: [{ slug: 'pompes', reps: 8, sets: 4, rest_sec: 90 }] },
      { type: 'superset', rounds: 3, rest_sec: 75, a: { slug: 'squat_bulgare', reps: 10 }, b: { slug: 'pompes', reps: 12 } },
      { type: 'superset', focus: 'core_runner', rounds: 3, rest_sec: 60,
        a: { slug: 'planche', duration_sec: 45 }, b: { slug: 'dead_bug', reps: 10 }, c: { slug: 'equilibre_unipodal', duration_sec: 30 } },
      { type: 'cooldown', items: [{ slug: 'posture_enfant', duration_sec: 45 }] },
    ],
  },
}

test('titreAffiche : coupe avant la partie de cycle', () => {
  assert.equal(titreAffiche('Corps complet – Semaine 2 (Progression)'), 'Corps complet')
  assert.equal(titreAffiche('Haut du corps — Semaine 1'), 'Haut du corps')
  assert.equal(titreAffiche('Jambes et tronc'), 'Jambes et tronc')
  assert.equal(titreAffiche('Pré-fatigue'), 'Pré-fatigue')
  assert.equal(titreAffiche(null), '')
})

test('ligneEnTete : à faire, puis faite avec le jour', () => {
  assert.equal(ligneEnTete(nouvelle), '≈ 63 min · 3 supersets')
  assert.equal(ligneEnTete(ancienne), 'Faite sam 24 oct · ≈ 35 min · 2 supersets')
  assert.equal(ligneEnTete({ ...ancienne, content: { ...ancienne.content, blocks: ancienne.content.blocks.slice(3, 4) } }),
    'Faite sam 24 oct · ≈ 35 min · 1 superset')
})

test('themesSeance : thèmes des supersets, ancien focus core_runner compris', () => {
  assert.equal(themesSeance(nouvelle.content), 'Jambes, Tirage, Tronc')
  assert.equal(themesSeance(ancienne.content), 'Tronc')
})

test('titreBloc et ligneBloc', () => {
  const [warmup, s1, , s3, cooldown] = nouvelle.content.blocks
  assert.equal(titreBloc(warmup), 'Échauffement')
  assert.equal(ligneBloc(warmup), 'Cercles de hanche, Balancements de jambe')
  assert.equal(titreBloc(s1), 'Jambes')
  assert.equal(ligneBloc(s1), '3 exercices · 3 tours · repos 60 s')
  assert.equal(ligneBloc(s3), '2 exercices · 1 tour · repos 60 s')
  assert.equal(titreBloc(cooldown), 'Retour au calme')
  const [, main, ab, abc] = ancienne.content.blocks
  assert.equal(titreBloc(main), 'Bloc principal')
  assert.equal(ligneBloc(main), 'Pompes')
  assert.equal(titreBloc(ab), 'Superset')
  assert.equal(ligneBloc(ab), '2 exercices · 3 tours · repos 75 s')
  assert.equal(titreBloc(abc), 'Tronc')
  assert.equal(ligneBloc(abc), '3 exercices · 3 tours · repos 60 s')
})

test('rangSuperset : rang parmi les supersets, null ailleurs', () => {
  assert.equal(rangSuperset(nouvelle.content, 2), 2)
  assert.equal(rangSuperset(nouvelle.content, 0), null)
  assert.equal(rangSuperset(ancienne.content, 3), 2)
})

test('ligneDose : dose et élastique, joué de préférence', () => {
  const tractions = { slug: 'tractions_assistees', reps: 10, band_kg: 15 }
  assert.equal(ligneDose(tractions, null), '10 rép. · élastique 15 kg')
  assert.equal(ligneDose(tractions, { tractions_assistees: 20 }), '10 rép. · élastique 20 kg')
  assert.equal(ligneDose({ slug: 'squat_bulgare', reps: 12 }, null), '12 rép. par côté')
  assert.equal(ligneDose({ slug: 'planche', duration_sec: 45 }, null), '45 s')
  assert.equal(ligneDose({ slug: 'pompes', reps: 8, sets: 4, rest_sec: 90 }, null, { type: 'main' }), '4 × 8 · repos 90 s')
  assert.equal(ligneDose({ slug: 'curl_biceps', reps: 12, band_kg: 12.5 }, null), '12 rép. · élastique 12,5 kg')
})

test('prevu : seulement quand la bande jouée diffère', () => {
  const dose = { slug: 'curl_marteau', reps: 12, band_kg: 15 }
  assert.equal(prevu(dose, { curl_marteau: 20 }), 'prévu 15 kg')
  assert.equal(prevu(dose, { curl_marteau: 15 }), null)
  assert.equal(prevu(dose, null), null)
  assert.equal(prevu({ slug: 'pompes', reps: 10 }, { pompes: 10 }), null)
})

test('pastillesExercice : barre, chaise, bande ou élastique générique', () => {
  assert.deepEqual(pastillesExercice('tractions_assistees', { kg: 15 }), [
    { variante: 'materiel', libelle: 'Barre en haut' }, { variante: 'bande', kg: 15 },
  ])
  assert.deepEqual(pastillesExercice('face_pull', { bandeGenerique: true }), [
    { variante: 'materiel', libelle: 'Barre à mi-hauteur' }, { variante: 'materiel', libelle: 'Élastique' },
  ])
  assert.deepEqual(pastillesExercice('tractions_negatives'), [
    { variante: 'materiel', libelle: 'Barre en haut' }, { variante: 'materiel', libelle: 'Chaise' },
  ])
  assert.deepEqual(pastillesExercice('pompes'), [])
  assert.deepEqual(pastillesExercice('inconnu'), [])
})

test('Remplacer : titre et sous-ligne', () => {
  assert.equal(titreRemplacer('tractions_assistees'), 'Remplacer Tractions assistées')
  assert.equal(sousLigneRemplacer(nouvelle.content, 2, 'tractions_assistees'),
    'Superset 2 · Haut du corps · exercices de tirage avec ton matériel')
  assert.equal(sousLigneRemplacer(nouvelle.content, 1, 'squat_bulgare'),
    'Superset 1 · Jambes · exercices de jambes avec ton matériel')
  assert.equal(sousLigneRemplacer(nouvelle.content, 1, 'mollet_excentrique'),
    'Superset 1 · Jambes · exercices de mollets et pieds avec ton matériel')
  assert.equal(sousLigneRemplacer(nouvelle.content, 0, 'cercles_hanche'),
    "Échauffement · exercices d'échauffement avec ton matériel")
  assert.equal(sousLigneRemplacer(nouvelle.content, 4, 'etirement_flechisseurs'),
    'Retour au calme · exercices de retour au calme avec ton matériel')
  assert.equal(sousLigneRemplacer(ancienne.content, 3, 'equilibre_unipodal'),
    "Superset 2 · Tronc · exercices d'équilibre avec ton matériel")
})

test('Confirmations : supprimer et réinitialiser', () => {
  assert.equal(phraseSuppression(nouvelle), "Corps complet sera supprimée. Tu pourras en créer une autre depuis l'accueil.")
  assert.equal(phraseSuppression(ancienne),
    'Corps complet, faite sam 24 oct, disparaîtra de ton Historique des séances et de ta semaine.')
  assert.equal(phraseReinitialisation(ancienne),
    'Corps complet repassera à faire. Ton ressenti sera effacé, les élastiques joués sont gardés.')
})
