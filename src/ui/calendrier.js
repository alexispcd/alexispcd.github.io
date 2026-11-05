// Calcul pur de la grille du Calendrier, en UTC, sur des dates yyyy-MM-dd et des mois
// yyyy-MM. Semaine du lundi. Testé par calendrier.test.js (node --test).

import { MOIS_LONGS } from '../lib/dates.js'

const pad = (n) => String(n).padStart(2, '0')

const lireMois = (mois) => mois.split('-').map(Number)

/** Mois (yyyy-MM) d'une date yyyy-MM-dd. */
export const moisDe = (iso) => iso.slice(0, 7)

/** Mois voisin : moisVoisin('2026-12', 1) === '2027-01'. */
export const moisVoisin = (mois, sens) => {
  const [y, m] = lireMois(mois)
  const d = new Date(Date.UTC(y, m - 1 + sens, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

/** « octobre 2026 ». */
export const libelleMois = (mois) => {
  const [y, m] = lireMois(mois)
  return `${MOIS_LONGS[m - 1]} ${y}`
}

/**
 * Grille d'un mois : toujours 42 cellules (6 semaines du lundi), la date yyyy-MM-dd
 * pour un jour du mois, null avant le premier et après le dernier.
 */
export const grilleMois = (mois) => {
  const [y, m] = lireMois(mois)
  const premier = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const avant = (premier + 6) % 7
  const nbJours = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: 42 }, (_, i) => {
    const jour = i - avant + 1
    return jour >= 1 && jour <= nbJours ? `${mois}-${pad(jour)}` : null
  })
}
