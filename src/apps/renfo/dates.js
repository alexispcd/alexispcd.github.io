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

/** Durée d'un cycle, en jours. */
export const CYCLE_DAYS = 28

/** Semaine du cycle (1 à 4) qui contient `today`, bornée au cycle. */
export const currentCycleWeek = (startDate, today = todayISO()) => {
  const diff = Math.floor((Date.parse(today) - Date.parse(startDate)) / 86_400_000)
  return Math.min(4, Math.max(1, Math.floor(diff / 7) + 1))
}

/** Vrai quand les 4 semaines du cycle sont écoulées. */
export const isCycleOver = (startDate, today = todayISO()) =>
  today >= addDaysISO(startDate, CYCLE_DAYS)

/** "6 au 12 oct." : bornes d'une semaine commençant le lundi `weekStart`. */
export const formatWeekRange = (weekStart) => {
  const fmt = (iso, opts) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', opts)
  const end = addDaysISO(weekStart, 6)
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7)
  return sameMonth
    ? `${fmt(weekStart, { day: 'numeric' })} au ${fmt(end, { day: 'numeric', month: 'short' })}`
    : `${fmt(weekStart, { day: 'numeric', month: 'short' })} au ${fmt(end, { day: 'numeric', month: 'short' })}`
}

/** Secondes en m:ss. */
export const formatClock = (sec) => {
  const s = Math.max(0, Math.round(sec ?? 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
