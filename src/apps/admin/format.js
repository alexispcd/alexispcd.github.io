const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const STEPS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** Date relative en français (« il y a 3 jours »), calculée par rapport à `now` (ms). */
export const formatRelative = (iso, now) => {
  if (!iso) return 'Jamais connecté'
  const diffSec = (new Date(iso).getTime() - now) / 1000
  for (const [unit, sec] of STEPS) {
    if (Math.abs(diffSec) >= sec) return rtf.format(Math.round(diffSec / sec), unit)
  }
  return 'à l\'instant'
}
