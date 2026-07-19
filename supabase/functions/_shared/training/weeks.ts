// Découpage calendaire des semaines d'entraînement (aligné lundi→dimanche) et
// plages de jours par zone (méthodo). Module pur de dates, partagé par
// generate-plan / regenerate-plan / regenerate-renfo / coros-match / validate.
//
// Une séance appartient à une SEMAINE + une ZONE (plage de jours), plus à un
// jour précis. La scheduled_date reste renseignée (tri, fenêtre coros-match)
// mais elle est indicative : elle doit simplement tomber dans la plage de sa zone.

// Fuseau de référence de l'utilisateur. Les Edge Functions tournent en UTC :
// dériver "aujourd'hui" d'un toISOString() renvoie la veille entre minuit et 02h
// à Paris (UTC+1/+2), ce qui décale toutes les comparaisons de dates d'un jour.
const USER_TZ = "Europe/Paris"
// en-CA formate en yyyy-MM-dd, le format calendaire utilisé partout ici.
const USER_DATE_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: USER_TZ })

/**
 * Date calendaire du jour (yyyy-MM-dd) dans le fuseau de l'utilisateur.
 * À utiliser pour TOUTE comparaison de dates calendaires : jamais
 * `new Date().toISOString()`.
 */
export function todayISO(): string {
  return USER_DATE_FMT.format(new Date())
}

/** yyyy-MM-dd → timestamp UTC minuit, ou NaN. */
export function dayTs(d: unknown): number {
  if (typeof d !== "string") return NaN
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

/** timestamp UTC minuit → yyyy-MM-dd. */
export function tsToISO(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

/** Décale une date yyyy-MM-dd de `days` jours (yyyy-MM-dd). */
export function addDaysISO(iso: string, days: number): string {
  return tsToISO(dayTs(iso) + days * 86_400_000)
}

/** Jour de la semaine : 1 = lundi … 7 = dimanche. */
export function dayOfWeek(iso: string): number {
  return ((new Date(dayTs(iso)).getUTCDay() + 6) % 7) + 1
}

/** Lundi de la semaine calendaire contenant `iso`. */
export function mondayOf(iso: string): string {
  return addDaysISO(iso, -(dayOfWeek(iso) - 1))
}

/** Dimanche de la semaine calendaire contenant `iso`. */
export function sundayOf(iso: string): string {
  return addDaysISO(iso, 7 - dayOfWeek(iso))
}

export interface WeekBounds {
  week_number: number
  /** Premier jour de la semaine (= startISO pour S1 partielle, sinon un lundi). */
  start: string
  /** Dernier jour de la semaine (= raceISO pour la dernière, sinon un dimanche). */
  end: string
}

/**
 * Découpe [startISO, raceISO] en semaines alignées lundi→dimanche :
 * - S1 va de startISO au dimanche suivant (semaine partielle possible),
 * - les suivantes lundi→dimanche,
 * - la dernière se termine à raceISO.
 * Renvoie au moins une semaine.
 */
export function computeWeekBounds(startISO: string, raceISO: string): WeekBounds[] {
  const bounds: WeekBounds[] = []
  const raceTs = dayTs(raceISO)
  let ws = startISO
  let n = 1
  // Garde-fou : borne le nombre d'itérations (plans réalistes < 60 semaines).
  while (n <= 120) {
    const sunday = sundayOf(ws)
    if (dayTs(sunday) >= raceTs) {
      bounds.push({ week_number: n, start: ws, end: raceISO })
      break
    }
    bounds.push({ week_number: n, start: ws, end: sunday })
    ws = addDaysISO(sunday, 1) // lundi suivant
    n++
  }
  return bounds
}

export type Zone = "A" | "B" | "C" | "renfo"

/** Plage de dates [start, end] autorisée pour une zone dans une semaine donnée,
 *  clippée aux bornes réelles de la semaine (S1 partielle). null si la zone ne
 *  tombe pas dans la fenêtre disponible (ex. démarrage un jeudi → pas de zone A). */
export function zoneRangeForWeek(bounds: WeekBounds, zone: Zone): { start: string; end: string } | null {
  if (zone === "renfo") return { start: bounds.start, end: bounds.end }

  const monday = mondayOf(bounds.start)
  const spans: Record<Exclude<Zone, "renfo">, [number, number]> = {
    A: [0, 1], // lundi → mardi
    B: [2, 4], // mercredi → vendredi
    C: [5, 6], // samedi → dimanche
  }
  const [lo, hi] = spans[zone]
  const rangeStart = addDaysISO(monday, lo)
  const rangeEnd = addDaysISO(monday, hi)

  // Intersection avec [bounds.start, bounds.end].
  const clippedStart = dayTs(rangeStart) < dayTs(bounds.start) ? bounds.start : rangeStart
  const clippedEnd = dayTs(rangeEnd) > dayTs(bounds.end) ? bounds.end : rangeEnd
  if (dayTs(clippedStart) > dayTs(clippedEnd)) return null
  return { start: clippedStart, end: clippedEnd }
}

/** Zones disponibles (plage non vide) dans une semaine, dans l'ordre A, B, C, renfo. */
export function availableZones(bounds: WeekBounds): Zone[] {
  return (["A", "B", "C", "renfo"] as Zone[]).filter((z) => zoneRangeForWeek(bounds, z) !== null)
}

const ZONE_LABEL: Record<Zone, string> = {
  A: "A (facile)",
  B: "B (qualité)",
  C: "C (sortie longue)",
  renfo: "renfo",
}

/**
 * Ligne de prompt décrivant une semaine calendaire : bornes + plages de jours
 * disponibles par zone. `isLast` marque la semaine de course (affûtage).
 * Partagé par les prompts de génération et de régénération.
 */
export function describeWeekBounds(b: WeekBounds, isLast: boolean): string {
  const zones = availableZones(b)
  const parts = zones.map((z) => {
    const r = zoneRangeForWeek(b, z)!
    return r.start === r.end ? `${ZONE_LABEL[z]} le ${r.start}` : `${ZONE_LABEL[z]} entre ${r.start} et ${r.end}`
  })
  const partial = b.week_number === 1 && zones.length < 4
    ? " [semaine partielle : ne génère QUE les zones listées]"
    : ""
  const race = isLast ? " [dernière semaine : se termine le jour de la course, affûtage]" : ""
  return `  Semaine ${b.week_number} : du ${b.start} au ${b.end}${race}${partial}\n    Plages par zone : ${parts.join(" ; ")}`
}
