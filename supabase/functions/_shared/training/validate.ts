import type { CompactStep, GeneratedPlan, PlanSession } from "./types.ts"
import { isRepeatBlock } from "./expand.ts"
import { dayOfWeek, dayTs, type WeekBounds, type Zone, zoneRangeForWeek } from "./weeks.ts"

// dayTs reste exposé depuis ce module (importé par d'autres fonctions Edge).
export { dayTs }

const BLOCKS = ["construction", "intensification", "affutage"]
const ZONES = ["A", "B", "C", "renfo"]
const TYPES = ["facile", "fractionne", "tempo", "sortie_longue", "renfo"]
const STEP_TYPES = ["warmup", "run", "interval", "recovery", "cooldown"]

export const isStrengthSession = (s: Pick<PlanSession, "type" | "zone">) =>
  s.type === "renfo" || s.zone === "renfo"

/**
 * Valide le contenu d'une séance (zone, type, title, steps / strength_content).
 * Ne vérifie PAS la date (réutilisable pour l'adaptation où la date ne change pas).
 */
export function validateSessionContent(s: PlanSession, tag: string, errors: string[]): void {
  if (!ZONES.includes(s.zone)) errors.push(`${tag} : zone invalide "${s.zone}"`)
  if (!TYPES.includes(s.type)) errors.push(`${tag} : type invalide "${s.type}"`)
  if (!s.title) errors.push(`${tag} : title manquant`)

  if (isStrengthSession(s)) {
    if (!s.strength_content || typeof s.strength_content !== "object") {
      errors.push(`${tag} : renfo sans strength_content`)
    }
    if (Array.isArray(s.steps) && s.steps.length > 0) {
      errors.push(`${tag} : renfo ne doit pas avoir de steps`)
    }
  } else {
    if (!Array.isArray(s.steps) || s.steps.length === 0) {
      errors.push(`${tag} : séance de course sans steps`)
    } else {
      validateSteps(s, tag, errors)
    }
  }
}

/** Valide le format COMPACT des steps (avant dépliage par expand.ts). */
function validateSteps(s: PlanSession, tag: string, errors: string[]): void {
  const steps = s.steps as CompactStep[]
  let repeatBlocks = 0

  steps.forEach((el, idx) => {
    const stag = `${tag} step ${idx + 1}`

    if (isRepeatBlock(el)) {
      repeatBlocks++
      if (!Number.isInteger(el.repeat) || el.repeat < 2) {
        errors.push(`${stag} : repeat doit être un entier ≥ 2`)
      }
      const iv = el.interval
      if (!iv || typeof iv !== "object") {
        errors.push(`${stag} : interval manquant`)
      } else {
        if (iv.distance_m == null && iv.duration_sec == null) {
          errors.push(`${stag} interval : distance_m ou duration_sec requis`)
        }
        if (iv.target_pace_sec == null) errors.push(`${stag} interval : target_pace_sec requis`)
      }
      if (el.recovery != null) {
        const rc = el.recovery
        if (rc.distance_m == null && rc.duration_sec == null) {
          errors.push(`${stag} recovery : distance_m ou duration_sec requis`)
        }
        // target_pace_sec optionnel sur recovery (récup en allure libre).
      }
    } else {
      if (!STEP_TYPES.includes(el.step_type)) errors.push(`${stag} : step_type invalide "${el.step_type}"`)
      if (el.distance_m == null && el.duration_sec == null) {
        errors.push(`${stag} : distance_m ou duration_sec requis`)
      }
      if (el.step_type !== "recovery" && el.target_pace_sec == null) {
        errors.push(`${stag} : target_pace_sec requis (sauf recovery)`)
      }
    }
  })

  if (s.type === "fractionne" && repeatBlocks === 0) {
    errors.push(`${tag} : fractionné sans bloc de répétitions (champ "repeat" requis)`)
  }
}

/**
 * Valide un plan (ou un sous-ensemble de semaines) renvoyé par le modèle contre
 * le schéma BDD et les règles métier. `firstWeek` = numéro de la première semaine
 * attendue (1 pour une génération complète, semaine courante pour une régénération).
 *
 * `boundsByWeek` (optionnel) : bornes calendaires lundi→dimanche par week_number.
 * Fourni → on valide en plus que chaque semaine est bien bornée (start = borne de
 * début de la semaine) et que la scheduled_date de chaque séance tombe dans la
 * plage de sa zone (renfo : dans la semaine). Voir _shared/training/weeks.ts.
 *
 * Retourne la liste des erreurs (vide si valide).
 */
export function validatePlan(
  plan: GeneratedPlan,
  todayStr: string,
  raceDateStr: string,
  firstWeek = 1,
  boundsByWeek?: Map<number, WeekBounds>,
): string[] {
  const errors: string[] = []
  const lo = dayTs(todayStr)
  const hi = dayTs(raceDateStr)

  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    errors.push("weeks doit être un tableau non vide")
    return errors
  }

  const sorted = [...plan.weeks].sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
  sorted.forEach((w, i) => {
    const expected = firstWeek + i
    const wn = w.week_number
    if (wn !== expected) errors.push(`week_number non continu : attendu ${expected}, reçu ${wn}`)
    if (!BLOCKS.includes(w.block)) errors.push(`semaine ${wn} : block invalide "${w.block}"`)

    const bounds = boundsByWeek?.get(wn)
    if (bounds) {
      // Bornes calendaires : start attendu = début de la semaine (lundi hors S1).
      if (w.start_date != null && w.start_date !== bounds.start) {
        errors.push(`semaine ${wn} : start_date ${w.start_date} attendu ${bounds.start} (semaine lundi→dimanche)`)
      }
    } else if (w.start_date != null) {
      const ts = dayTs(w.start_date)
      if (Number.isNaN(ts)) errors.push(`semaine ${wn} : start_date invalide "${w.start_date}"`)
      else if (ts < lo || ts > hi) errors.push(`semaine ${wn} : start_date ${w.start_date} hors [${todayStr}, ${raceDateStr}]`)
    }

    if (!Array.isArray(w.sessions) || w.sessions.length === 0) {
      errors.push(`semaine ${wn} : aucune séance`)
      return
    }

    w.sessions.forEach((s, si) => {
      const tag = `semaine ${wn} séance ${si + 1}`
      const ts = dayTs(s.scheduled_date)
      if (Number.isNaN(ts)) errors.push(`${tag} : scheduled_date invalide "${s.scheduled_date}"`)
      else if (ts < lo || ts > hi) errors.push(`${tag} : scheduled_date ${s.scheduled_date} hors [${todayStr}, ${raceDateStr}]`)
      else if (bounds && (s.zone === "A" || s.zone === "B" || s.zone === "C" || s.zone === "renfo")) {
        validateSessionPlacement(s.zone as Zone, s.scheduled_date, bounds, wn, tag, errors)
      }
      validateSessionContent(s, tag, errors)
    })
  })

  return errors
}

/** Vérifie que la scheduled_date d'une séance tombe dans la plage de sa zone. */
function validateSessionPlacement(
  zone: Zone,
  scheduledDate: string,
  bounds: WeekBounds,
  weekNumber: number,
  tag: string,
  errors: string[],
): void {
  const range = zoneRangeForWeek(bounds, zone)
  if (!range) {
    errors.push(`${tag} : zone ${zone} indisponible en semaine ${weekNumber} (plage hors de la semaine partielle)`)
    return
  }
  const ts = dayTs(scheduledDate)
  if (ts < dayTs(range.start) || ts > dayTs(range.end)) {
    const label = zone === "renfo" ? "la semaine" : `la plage zone ${zone}`
    errors.push(`${tag} : scheduled_date ${scheduledDate} (${zoneDow(scheduledDate)}) hors de ${label} [${range.start} → ${range.end}]`)
  }
}

const DOW_LABELS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
const zoneDow = (iso: string) => DOW_LABELS[dayOfWeek(iso) - 1] ?? "?"
