// Séance en attente de Modifier (lot R7), sans React : tout reste ici jusqu'à
// « Enregistrer ». Testé par modifier.test.js.
//
// etat = { warmup: [ex], supersets: [{ id, focus, rounds, exercises: [ex], retire, apparait }], cooldown: [ex] }
// ex = { slug, origine, remplace, dose } : origine, l'exercice était dans la séance ;
// remplace, l'exercice d'origine qu'il remplace (son élastique est repris).
// Un bloc se désigne par sa clé : 'warmup', 'cooldown' ou l'id d'un superset.

import {
  doseEnEdition, dosesParSlug,
} from '../../../../supabase/functions/_shared/strength/compose.ts'
import {
  COOLDOWN_EDIT_MAX, COOLDOWN_ITEMS_MIN, GROUP_LABELS, groupOfFocus, SUPERSET_EXERCISES_MAX,
  SUPERSET_EXERCISES_MIN, WARMUP_EDIT_MAX, WARMUP_ITEMS_MIN,
} from '../../../../supabase/functions/_shared/strength/rules.ts'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'

export const TOURS_PAR_DEFAUT = 3

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Identifiant stable de chaque superset à l'écran (clé React, accordéon).
let prochainId = 1

const estListe = (cle) => cle === 'warmup' || cle === 'cooldown'

/**
 * Contexte de dosage d'un nouvel exercice : doses de la séance d'origine, bases du
 * compte et élastiques (comme le serveur, doseEnEdition).
 */
export const contexteDosage = (content, bases, bandsKg) => ({ anciennes: dosesParSlug(content), bases: bases ?? {}, bandsKg })

const exDe = (slug, remplace, ctx) => ({
  slug,
  origine: Boolean(ctx.anciennes[slug]) && !remplace,
  remplace: remplace ?? null,
  dose: doseEnEdition(slug, remplace, ctx),
})

/** État de départ : la séance telle qu'elle est. */
export const etatDe = (content) => {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const ex = (d) => ({ slug: d.slug, origine: true, remplace: null, dose: { ...d } })
  const items = (type) => (blocks.find((b) => b.type === type)?.items ?? []).map(ex)
  return {
    warmup: items('warmup'),
    supersets: blocks.filter((b) => b.type === 'superset').map((b) => ({
      id: prochainId++,
      focus: b.focus,
      rounds: Number(b.rounds),
      exercises: (b.exercises ?? []).map(ex),
      retire: false,
      apparait: false,
    })),
    cooldown: items('cooldown'),
  }
}

/** Supersets encore dans la séance (un superset retiré se referme avant de quitter la liste). */
export const actifs = (etat) => etat.supersets.filter((s) => !s.retire)

/** Exercices d'un bloc. */
export const exercicesDe = (etat, cle) =>
  (estListe(cle) ? etat[cle] : etat.supersets.find((s) => s.id === cle)?.exercises ?? [])

/** Nombre d'exercices au plus d'un bloc : 4 pour un superset, 3 pour l'échauffement et le retour au calme. */
export const maxDe = (cle) => {
  if (cle === 'warmup') return WARMUP_EDIT_MAX
  if (cle === 'cooldown') return COOLDOWN_EDIT_MAX
  return SUPERSET_EXERCISES_MAX
}

const minDe = (cle) => {
  if (cle === 'warmup') return WARMUP_ITEMS_MIN
  if (cle === 'cooldown') return COOLDOWN_ITEMS_MIN
  return SUPERSET_EXERCISES_MIN
}

const avecExercices = (etat, cle, fn) => (estListe(cle)
  ? { ...etat, [cle]: fn(etat[cle]) }
  : { ...etat, supersets: etat.supersets.map((s) => (s.id === cle ? { ...s, exercises: fn(s.exercises) } : s)) })

/** Bloc attendu par exercicesProposes : 'warmup', 'cooldown' ou l'index du superset parmi les actifs. */
export const blocEdition = (etat, cle) => (estListe(cle) ? cle : actifs(etat).findIndex((s) => s.id === cle))

export const retirerExercice = (etat, cle, slug) => avecExercices(etat, cle, (list) => list.filter((e) => e.slug !== slug))

export const ajouterExercice = (etat, cle, slug, ctx) => avecExercices(etat, cle, (list) => [...list, exDe(slug, null, ctx)])

/**
 * `ancien` remplacé par `slug`, à sa place. L'élastique repris est celui de l'exercice
 * d'origine : l'ancien lui-même s'il était dans la séance, sinon celui qu'il remplaçait.
 * Échauffement et retour au calme : sans reprise (le serveur ne la reçoit pas pour eux).
 */
export const remplacerExercice = (etat, cle, ancien, slug, ctx) => avecExercices(etat, cle, (list) => list.map((e) => {
  if (e.slug !== ancien) return e
  const remplace = estListe(cle) ? null : e.origine ? e.slug : e.remplace
  return exDe(slug, remplace, ctx)
}))

const avecSuperset = (etat, id, champs) => ({
  ...etat,
  supersets: etat.supersets.map((s) => (s.id === id ? { ...s, ...champs } : s)),
})

export const changerTours = (etat, id, rounds) => avecSuperset(etat, id, { rounds })

/** Nouveau thème : la liste se vide, les tours restent. */
export const changerTheme = (etat, id, focus) => avecSuperset(etat, id, { focus, exercises: [] })

/** Superset ajouté en fin de liste, vide, avec 3 tours. Renvoie { etat, id }. */
export const ajouterSuperset = (etat, focus) => {
  const id = prochainId++
  return {
    id,
    etat: {
      ...etat,
      supersets: [...etat.supersets, { id, focus, rounds: TOURS_PAR_DEFAUT, exercises: [], retire: false, apparait: true }],
    },
  }
}

/** Le superset se referme (retire), puis enleverSuperset le sort de la liste. */
export const retirerSuperset = (etat, id) => avecSuperset(etat, id, { retire: true })

export const enleverSuperset = (etat, id) => ({ ...etat, supersets: etat.supersets.filter((s) => s.id !== id) })

/** Séance envoyée à l'action edit. */
export const seanceDe = (etat) => ({
  warmup: etat.warmup.map((e) => e.slug),
  supersets: actifs(etat).map((s) => ({
    focus: s.focus,
    rounds: s.rounds,
    exercises: s.exercises.map((e) => (e.remplace ? { slug: e.slug, remplace: e.remplace } : { slug: e.slug })),
  })),
  cooldown: etat.cooldown.map((e) => e.slug),
})

/** Même séance : mêmes exercices dans le même ordre, mêmes thèmes et mêmes tours. */
export const memeSeance = (a, b) => {
  const x = seanceDe(a)
  const y = seanceDe(b)
  const slugs = (list) => list.map((e) => (typeof e === 'string' ? e : e.slug)).join(',')
  return slugs(x.warmup) === slugs(y.warmup) &&
    slugs(x.cooldown) === slugs(y.cooldown) &&
    x.supersets.length === y.supersets.length &&
    x.supersets.every((s, i) => {
      const t = y.supersets[i]
      return s.focus === t.focus && s.rounds === t.rounds && slugs(s.exercises) === slugs(t.exercises)
    })
}

/** Phrase d'un bloc qui n'a pas assez d'exercices, sinon null. */
export const manqueDe = (etat, cle) => {
  const min = minDe(cle)
  if (exercicesDe(etat, cle).length >= min) return null
  return min > 1 ? `Au moins ${min} exercices.` : 'Au moins 1 exercice.'
}

/** Blocs qui n'ont pas assez d'exercices, dans l'ordre de l'écran : [{ cle, phrase }]. */
export const manques = (etat) => ['warmup', ...actifs(etat).map((s) => s.id), 'cooldown']
  .map((cle) => ({ cle, phrase: manqueDe(etat, cle) }))
  .filter((m) => m.phrase)

/** Sous-ligne repliée : « Jambes · 3 exercices, 3 tours », ou les noms des exercices. */
export const sousLigneBloc = (etat, cle) => {
  if (estListe(cle)) return etat[cle].map((e) => EXERCISE_INDEX[e.slug]?.name ?? e.slug).join(', ')
  const s = etat.supersets.find((x) => x.id === cle)
  if (!s) return ''
  const groupe = GROUP_LABELS[groupOfFocus(s.focus)] ?? ''
  return `${groupe} · ${pluriel(s.exercises.length, 'exercice')}, ${pluriel(s.rounds, 'tour')}`
}
