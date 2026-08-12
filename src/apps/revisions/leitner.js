// Moteur Leitner a 5 boites. Logique pure : pas de React, pas de Supabase, pas de DOM.

// Plafond de cartes jamais vues introduites dans une session.
// La valeur 0 est valide et signifie "aucune carte nouvelle, uniquement du rappel".
export const NEW_CARDS_PER_SESSION = 20

export const MAX_BOX = 5

// Delai de reapparition en jours, par boite.
const BOX_DELAYS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }

export const boxDelay = (box) => BOX_DELAYS[box] ?? 1

// Formate une Date en YYYY-MM-DD dans le fuseau LOCAL de l'appareil.
// toISOString bascule en UTC et decalerait la date le soir en heure francaise.
export const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const todayKey = () => toDateKey(new Date())

// Decale une cle de date d'un nombre de jours, en restant en date locale.
export const addDays = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return toDateKey(new Date(year, month - 1, day + days))
}

// Une carte sans ligne de progression vaut boite 1, due aujourd'hui.
export const defaultProgress = (today = todayKey()) => ({ box: 1, due_on: today })

export const isDue = (row, today = todayKey()) => Boolean(row) && row.due_on <= today

// Reponse "su" : la carte monte d'une boite et repart pour le delai de cette boite.
export const gradeKnown = (row, today = todayKey()) => {
  const box = Math.min((row?.box ?? 1) + 1, MAX_BOX)
  return { box, due_on: addDays(today, boxDelay(box)) }
}

// Reponse "pas su" : retour en boite 1, revue des demain.
export const gradeUnknown = (today = todayKey()) => ({ box: 1, due_on: addDays(today, 1) })

export const grade = (row, known, today = todayKey()) =>
  known ? gradeKnown(row, today) : gradeUnknown(today)

// Boite affichee pour une carte : celle de sa ligne, sinon boite 1 par defaut.
export const boxOf = (row) => row?.box ?? 1

// Le melange est deterministe pour une graine donnee, et non aleatoire a chaque
// appel. L'accueil et la session recomposent ainsi exactement la meme file a
// partir des memes filtres et de la meme progression, sans se transmettre la
// file : le compteur annonce vaut donc pour la session, carte par carte.
const hashString = (value) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const randomFrom = (seed) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Melange de Fisher-Yates, sur une copie.
const shuffle = (items, random) => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}

// Aucun filtre actif : les trois groupes sont cumulables et vides par defaut.
export const EMPTY_FILTERS = { themes: [], types: [], angles: [] }

// Un filtre vide ou absent ne filtre rien.
const passes = (value, selected) => !selected || selected.length === 0 || selected.includes(value)

export const matchesFilters = (card, filters = {}) =>
  passes(card.themeId, filters.themes)
  && passes(card.type, filters.types)
  && passes(card.angle, filters.angles)

/**
 * Compose la file d'une session.
 *
 * Ordre impose :
 *   1. filtres actifs
 *   2. separation cartes DUES (ligne existante et due_on <= aujourd'hui) / NEUVES (aucune ligne)
 *   3. dues : tri par due_on croissant, ecretage eventuel, PUIS melange de l'ensemble retenu
 *   4. neuves : melange, PUIS coupe a newLimit
 *   5. file finale : dues melangees, ensuite neuves
 *
 * Le tri par anciennete ne sert qu'a selectionner : il a disparu de l'ordre affiche.
 * dueLimit est une logique dormante, aucun plafond global n'existe aujourd'hui.
 *
 * Fonction pure : a entrees egales, meme file, meme ordre.
 */
export const buildSession = (allCards, progressById = {}, options = {}) => {
  const {
    filters = {},
    today = todayKey(),
    dueLimit = null,
    newLimit = NEW_CARDS_PER_SESSION,
  } = options

  const random = randomFrom(hashString([
    today,
    (filters.themes ?? []).join(','),
    (filters.types ?? []).join(','),
    (filters.angles ?? []).join(','),
  ].join('|')))

  const pool = allCards.filter((card) => matchesFilters(card, filters))

  const due = []
  const fresh = []
  for (const card of pool) {
    const row = progressById[card.id]
    if (!row) fresh.push(card)
    else if (isDue(row, today)) due.push(card)
  }

  const dueSorted = [...due].sort((a, b) => {
    const left = progressById[a.id].due_on
    const right = progressById[b.id].due_on
    return left < right ? -1 : left > right ? 1 : 0
  })
  const dueKept = shuffle(dueLimit === null ? dueSorted : dueSorted.slice(0, dueLimit), random)

  const freshKept = shuffle(fresh, random).slice(0, Math.max(0, newLimit))

  return { queue: [...dueKept, ...freshKept], due: dueKept, fresh: freshKept }
}
