// Dates courtes partagées par toute l'app, sur des dates calendaires yyyy-MM-dd lues en UTC.

export const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
export const MOIS_COURTS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

const lire = (iso) => {
  if (!iso) return null
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(date.getTime()) ? null : date
}

/** yyyy-MM-dd → "jeu 29 oct" (sans point, comme le Design System). */
export const formatShortDay = (iso) => {
  const date = lire(iso)
  if (!date) return ''
  return `${JOURS_COURTS[date.getUTCDay()]} ${date.getUTCDate()} ${MOIS_COURTS[date.getUTCMonth()]}`
}

/** yyyy-MM-dd → "mar 26 janv 2027" : le jour court suivi de l'année. */
export const formatShortDayAnnee = (iso) => {
  const date = lire(iso)
  if (!date) return ''
  return `${formatShortDay(iso)} ${date.getUTCFullYear()}`
}
