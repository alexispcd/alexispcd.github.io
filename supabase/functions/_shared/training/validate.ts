import type { GeneratedPlan, PlanSession, PlanStep } from "./types.ts"

const BLOCKS = ["construction", "intensification", "affutage"]
const ZONES = ["A", "B", "C", "renfo"]
const TYPES = ["facile", "fractionne", "tempo", "sortie_longue", "renfo"]
const STEP_TYPES = ["warmup", "run", "interval", "recovery", "cooldown"]

export const isStrengthSession = (s: Pick<PlanSession, "type" | "zone">) =>
  s.type === "renfo" || s.zone === "renfo"

/** Parse une date yyyy-MM-dd en timestamp UTC (00:00), ou NaN. */
export function dayTs(d: unknown): number {
  if (typeof d !== "string") return NaN
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

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

function validateSteps(s: PlanSession, tag: string, errors: string[]): void {
  const steps = s.steps as PlanStep[]
  const seenOrder = new Set<number>()

  steps.forEach((st, idx) => {
    const stag = `${tag} step ${idx + 1}`
    if (!STEP_TYPES.includes(st.step_type)) errors.push(`${stag} : step_type invalide "${st.step_type}"`)

    if (st.order_index == null || typeof st.order_index !== "number") {
      errors.push(`${stag} : order_index manquant`)
    } else if (seenOrder.has(st.order_index)) {
      errors.push(`${stag} : order_index dupliqué ${st.order_index}`)
    } else {
      seenOrder.add(st.order_index)
    }

    const hasDist = st.distance_m != null
    const hasDur = st.duration_sec != null
    if (!hasDist && !hasDur) errors.push(`${stag} : distance_m ou duration_sec requis`)

    if (st.step_type !== "recovery" && st.target_pace_sec == null) {
      errors.push(`${stag} : target_pace_sec requis (sauf recovery)`)
    }
  })

  if (s.type === "fractionne") {
    const groups = new Map<number, { interval: number; recovery: number }>()
    for (const st of steps) {
      if (st.repeat_group == null) continue
      const g = groups.get(st.repeat_group) ?? { interval: 0, recovery: 0 }
      if (st.step_type === "interval") g.interval++
      if (st.step_type === "recovery") g.recovery++
      groups.set(st.repeat_group, g)
    }
    const coherent = [...groups.values()].some((g) => g.interval > 0 && g.recovery > 0)
    if (!coherent) {
      errors.push(`${tag} : fractionné sans groupe interval/recovery cohérent (repeat_group requis)`)
    }
  }
}

/**
 * Valide un plan (ou un sous-ensemble de semaines) renvoyé par le modèle contre
 * le schéma BDD et les règles métier. `firstWeek` = numéro de la première semaine
 * attendue (1 pour une génération complète, semaine courante pour une régénération).
 * Retourne la liste des erreurs (vide si valide).
 */
export function validatePlan(
  plan: GeneratedPlan,
  todayStr: string,
  raceDateStr: string,
  firstWeek = 1,
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
    if (w.start_date != null) {
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
      validateSessionContent(s, tag, errors)
    })
  })

  return errors
}
