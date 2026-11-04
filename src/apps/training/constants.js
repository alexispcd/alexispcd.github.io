// Constantes & helpers partagés de l'outil Training.
// La pastille d'une séance = couleur de sa zone (plus de TYPE_DOT).

import { JOURS_COURTS, formatShortDay as formatShortDayDates } from '../../lib/dates.js'

// Variables CSS du thème (src/styles/theme.js) : la couleur suit le thème sans
// passer par JS. Ce sont des chaînes `var(...)` : aucune opération de couleur dessus.
// La couleur ne dit que l'intensité : vert facile, orange qualité, bleu sortie longue.
export const ZONE_STYLE = {
  A:     { main: 'var(--zone-facile)', bg: 'var(--zone-facile-tint)' },
  B:     { main: 'var(--zone-qualite)', bg: 'var(--zone-qualite-tint)' },
  C:     { main: 'var(--zone-longue)', bg: 'var(--zone-longue-tint)' },
}

// Statut, bloc et résultat ne portent pas de couleur : neutres.
export const NEUTRAL_STYLE = { main: 'var(--ink)', bg: 'var(--chip)' }

export const BLOCK_STYLE = {
  construction:    { main: 'var(--muted)', bg: 'var(--chip)' },
  intensification: { main: 'var(--muted)', bg: 'var(--chip)' },
  affutage:        { main: 'var(--muted)', bg: 'var(--chip)' },
}

// Pastille "adaptée" : partagée entre le dashboard (SessionRow) et la vue séance.
export const ADAPTED_STYLE = NEUTRAL_STYLE

// Verdict d'analyse post-séance : label + couleur (icônes côté vue séance).
export const VERDICT = {
  reussie:        { label: 'Séance réussie', color: 'var(--ink)' },
  partiellement:  { label: 'Séance partiellement réussie', color: 'var(--ink)' },
  a_retravailler: { label: 'À retravailler', color: 'var(--ink)' },
}

// ── Labels FR ────────────────────────────────────────────────────────────────
export const ZONE_LABEL = {
  A: 'Zone A',
  B: 'Zone B',
  C: 'Zone C',
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
}

export const PLAN_STATUS_LABEL = {
  active: 'Actif',
  completed: 'Terminé',
  archived: 'Archivé',
}

// ── Zones : ordre d'affichage + plage de jours (méthodo) ─────────────────────
export const ZONE_ORDER = ['A', 'B', 'C']

export const ZONE_SUBLABEL = {
  A: 'Facile',
  B: 'Qualité',
  C: 'Sortie longue',
}

/**
 * Intensité RENDUE d'une séance, dérivée de son type et non de sa zone.
 * La zone reste le créneau de jours ; après une adaptation, une séance de
 * qualité peut occuper la zone A, qui doit alors s'afficher comme telle.
 */
export const intensityOf = (type) => ({
  facile: 'A',
  fractionne: 'B',
  tempo: 'B',
  sortie_longue: 'C',
}[type] ?? 'A')

// Plages de jours par zone (tirets simples, jamais de cadratin).
export const ZONE_DAYS = {
  A: 'Lun-Mar',
  B: 'Mer-Ven',
  C: 'Sam-Dim',
}

// Jours de chaque créneau, en décalage depuis le lundi.
const CRENEAU_JOURS = { A: [0, 1], B: [2, 3, 4], C: [5, 6] }

/**
 * Dates (yyyy-MM-dd) du créneau d'une zone dans la semaine de scheduledDate, semaine du
 * lundi : A lundi et mardi, B mercredi à vendredi, C samedi et dimanche.
 */
export const joursCreneau = (scheduledDate, zone) => {
  const decalages = CRENEAU_JOURS[zone]
  if (!scheduledDate || !decalages) return []
  const [y, m, d] = scheduledDate.slice(0, 10).split('-').map(Number)
  const jour = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (Number.isNaN(jour)) return []
  const lundi = addDaysISO(scheduledDate.slice(0, 10), -((jour + 6) % 7))
  return decalages.map((n) => addDaysISO(lundi, n))
}

const DOW_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/** "Jeu 9" à partir d'une date ISO (jour réel d'une séance faite). */
export const shortDayLabel = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()}`
}

/**
 * Groupe les séances d'une semaine par zone, dans l'ordre A, B, C.
 * Ne renvoie que les zones ayant au moins une séance (groupes vides masqués).
 * Chaque groupe : { zone, sessions, done, total }.
 */
export const groupSessionsByZone = (sessions) => {
  const byZone = new Map(ZONE_ORDER.map((z) => [z, []]))
  for (const s of sessions ?? []) {
    const z = ZONE_ORDER.includes(s.zone) ? s.zone : 'A'
    byZone.get(z).push(s)
  }
  return ZONE_ORDER
    .map((zone) => {
      const list = byZone.get(zone)
      return { zone, sessions: list, done: list.filter((s) => s.status === 'done').length, total: list.length }
    })
    .filter((g) => g.total > 0)
}

/**
 * Nettoyage défensif des textes générés par l'IA : supprime tout tiret cadratin
 * ou demi-cadratin résiduel (title, rationale, advice, focus…) et le remplace
 * par un séparateur médian propre. Idempotent, sûr sur null/undefined.
 */
export const cleanText = (str) => {
  if (str == null) return str
  return String(str).replace(/\s*[—–]\s*/g, ' · ')
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

/** Minutes → "50 min" (< 60) ou "1h12min" / "2h" (≥ 60, minutes sur 2 chiffres). */
export const formatMin = (min) => {
  if (!min) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}min`
}

/** Secondes → "15 min" / "1h12min" (multiples de minute) ou "1:30" (m:ss). */
export const formatDuration = (sec) => {
  if (!sec) return null
  if (sec % 60 === 0) return formatMin(sec / 60)
  return formatPace(sec)
}

// ── Parsers (inverse des formatters, tolérants pour la saisie utilisateur) ─────

/** "4:20" / "4.20" / "4 20" → secondes (allure m:ss). null si invalide. */
export const parsePaceInput = (str) => {
  if (str == null) return null
  const parts = String(str).trim().split(/[:.\s]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const [m, s] = parts.map(Number)
  if (Number.isNaN(m) || Number.isNaN(s) || s >= 60) return null
  return m * 60 + s
}

/** "1:29:00" (h:mm:ss) ou "42:30" (m:ss) → secondes. null si invalide. */
export const parseTimeInput = (str) => {
  if (str == null) return null
  const parts = String(str).trim().split(/[:.\s]+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map(Number)
  if (nums.some(Number.isNaN)) return null
  const [h, m, s] = parts.length === 3 ? nums : [0, ...nums]
  if (m >= 60 || s >= 60) return null
  return h * 3600 + m * 60 + s
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

/** Date calendaire du jour (yyyy-MM-dd) dans le fuseau du navigateur. */
export const todayISO = () => new Date().toLocaleDateString('en-CA')

/** Décale une date yyyy-MM-dd de `days` jours. */
export const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Fenêtre d'envoi vers la montre acceptée par Coros : aujourd'hui à J+90. */
export const COROS_PUSH_WINDOW_DAYS = 90

/** Vrai si la copie Coros d'une séance est datée d'aujourd'hui ou plus tard. */
export const isCorosCopyUpcoming = (session, today = todayISO()) =>
  Boolean(session?.coros_workout_id && session.coros_workout_date && session.coros_workout_date >= today)

/** Avertissement : séances envoyées qu'une suppression laissera sur la montre. */
export const onWatchWarning = (n) =>
  `${n} séance${n > 1 ? 's' : ''} déjà envoyée${n > 1 ? 's' : ''} ${n > 1 ? 'resteront' : 'restera'} sur ta montre, à supprimer dans l'app Coros.`

// Jour court partagé (src/lib/dates.js), réexporté pour les écrans de Training.
export { formatShortDay } from '../../lib/dates.js'

// Jour de la semaine d'une date yyyy-MM-dd, lundi 0 à dimanche 6 (lue en UTC).
const jourLundi = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/**
 * Fenêtre de recherche des activités d'une séance, comme coros-match : la semaine
 * (lundi au dimanche) de startDate, début de la semaine du plan, sinon de
 * scheduledDate ; bornée à aujourd'hui, jamais avant le lundi.
 * → { debut, fin } en yyyy-MM-dd, ou null sans date.
 */
export const fenetreRecherche = (startDate, scheduledDate, aujourdhui) => {
  const ancre = (startDate ?? scheduledDate)?.slice(0, 10)
  if (!ancre) return null
  const lundi = addDaysISO(ancre, -jourLundi(ancre))
  const dimanche = addDaysISO(lundi, 6)
  const fin = dimanche > aujourdhui ? aujourdhui : dimanche
  return { debut: lundi, fin: fin < lundi ? lundi : fin }
}

/**
 * Texte d'une fenêtre de recherche : « le lun 2 nov » sur un seul jour, « entre le
 * lun 2 et le mer 4 nov » dans un même mois, « entre le lun 26 oct et le mer 4 nov » sinon.
 */
export const plageRecherche = ({ debut, fin }) => {
  if (debut === fin) return `le ${formatShortDayDates(debut)}`
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7)
  const premier = memeMois
    ? `${JOURS_COURTS[(jourLundi(debut) + 1) % 7]} ${Number(debut.slice(8, 10))}`
    : formatShortDayDates(debut)
  return `entre le ${premier} et le ${formatShortDayDates(fin)}`
}

/**
 * Jour proposé pour une séance validée sans activité : le plus ancien entre la date
 * prévue et aujourd'hui (aujourd'hui sans date prévue), jamais un jour à venir.
 */
export const jourSeanceParDefaut = (scheduledDate, aujourdhui) => {
  const prevue = scheduledDate?.slice(0, 10)
  return prevue && prevue < aujourdhui ? prevue : aujourdhui
}

/** yyyy-MM-dd → "jeudi 8 octobre". */
export const formatLongDay = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

/** Jours calendaires jusqu'à la course (peut être négatif si passée). */
export const daysUntil = (raceDate) => {
  if (!raceDate) return null
  const ms = midnight(raceDate) - midnight(new Date())
  return Math.round(ms / 86_400_000)
}

/**
 * "Semaine du 6 au 12 juillet" (même mois) ou "Semaine du 29 juin au 5 juillet".
 * end = veille du start de la semaine suivante, sinon start + 6 jours (gère la S1 partielle).
 */
export const formatWeekRange = (week, nextWeek) => {
  if (!week?.start_date) return ''
  const start = midnight(week.start_date)
  const end = nextWeek?.start_date
    ? new Date(midnight(nextWeek.start_date).getTime() - 86_400_000)
    : new Date(start.getTime() + 6 * 86_400_000)
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = sameMonth
    ? String(start.getDate())
    : start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const endLabel = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  return `Semaine du ${startLabel} au ${endLabel}`
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
