// Constantes & helpers partagés de l'outil Training.
// La pastille d'une séance = couleur de sa zone (plus de TYPE_DOT).

export const ZONE_STYLE = {
  A:     { main: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
  B:     { main: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  C:     { main: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  renfo: { main: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
}

// Teintes des blocs — distinctes des zones, lisibles en dark mode.
export const BLOCK_STYLE = {
  construction:    { main: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  intensification: { main: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  affutage:        { main: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
}

// ── Labels FR ────────────────────────────────────────────────────────────────
export const ZONE_LABEL = {
  A: 'Zone A',
  B: 'Zone B',
  C: 'Zone C',
  renfo: 'Renfo',
}

export const BLOCK_LABEL = {
  construction: 'Construction',
  intensification: 'Intensification',
  affutage: 'Affûtage',
}

export const STATUS_LABEL = {
  planned: 'À venir',
  done: 'Faite',
  skipped: 'Sautée',
  adapted: 'Adaptée',
}

export const TYPE_LABEL = {
  facile: 'Footing facile',
  fractionne: 'Fractionné',
  tempo: 'Tempo',
  sortie_longue: 'Sortie longue',
  renfo: 'Renfo',
}

export const PLAN_STATUS_LABEL = {
  active: 'Actif',
  completed: 'Terminé',
  archived: 'Archivé',
}

// ── Formatters ───────────────────────────────────────────────────────────────

/** Secondes → "1:29:00" (h:mm:ss) ou "42:30" (m:ss). */
export const formatGoalTime = (sec) => {
  if (sec == null || Number.isNaN(sec)) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Mètres → "9,4" (km, virgule décimale, entiers sans décimale). */
export const formatKm = (m) => {
  if (!m) return null
  const km = m / 1000
  return (Number.isInteger(km) ? String(km) : km.toFixed(1)).replace('.', ',')
}

/** Secondes/km → "3:40" (allure, sans suffixe). */
export const formatPace = (sec) => {
  if (sec == null || Number.isNaN(sec)) return null
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Mètres → "400 m" (sous le km) ou "9,4 km" (au-dessus). */
export const formatDistance = (m) => {
  if (!m) return null
  return m < 1000 ? `${Math.round(m)} m` : `${formatKm(m)} km`
}

/** Secondes → "15 min" (multiples de minute) ou "1:30" (m:ss). */
export const formatDuration = (sec) => {
  if (!sec) return null
  if (sec % 60 === 0) return `${sec / 60} min`
  return formatPace(sec)
}

/** Mètres → label course : "10 km", "Semi", "Marathon", sinon "X km". */
export const raceDistanceLabel = (m) => {
  if (!m) return ''
  if (m >= 20500 && m <= 21500) return 'Semi'
  if (m >= 41800 && m <= 42500) return 'Marathon'
  return `${Math.round(m / 1000)} km`
}

/** yyyy-MM-dd (minuit local). */
const midnight = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Jours calendaires jusqu'à la course (peut être négatif si passée). */
export const daysUntil = (raceDate) => {
  if (!raceDate) return null
  const ms = midnight(raceDate) - midnight(new Date())
  return Math.round(ms / 86_400_000)
}

/** Numéro de la semaine courante d'après les start_date des semaines. */
export const currentWeekNumber = (weeks) => {
  if (!weeks?.length) return 1
  const today = midnight(new Date())
  let cur = weeks[0].week_number
  for (const w of weeks) {
    if (w.start_date && midnight(w.start_date) <= today) cur = w.week_number
  }
  return cur
}
