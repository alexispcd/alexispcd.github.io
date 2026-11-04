// Dates du module Renfo, en jours calendaires locaux (yyyy-MM-dd). Le serveur
// calcule les siennes en Europe/Paris ; l'appareil est dans le même fuseau.

/** Aujourd'hui, en date locale. */
export const todayISO = () => new Date().toLocaleDateString('en-CA')

/** Décale une date yyyy-MM-dd de `days` jours (calcul en UTC, sans dérive d'heure). */
export const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Lundi de la semaine d'une date yyyy-MM-dd. */
export const mondayOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDaysISO(iso, dow === 0 ? -6 : 1 - dow)
}

/** Secondes en m:ss. */
export const formatClock = (sec) => {
  const s = Math.max(0, Math.round(sec ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
