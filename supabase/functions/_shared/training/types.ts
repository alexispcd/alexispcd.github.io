// Structure de plan produite par le modèle et partagée par generate-plan /
// regenerate-plan / adapt-sessions.
//
// Deux représentations des steps d'une séance de course :
//   • COMPACTE (sortie modèle) : les répétitions de fractionné ne sont PAS
//     aplaties — un bloc { repeat, interval, recovery } vaut N répétitions.
//     C'est ce que le modèle émet (bien moins de tokens).
//   • APLATIE (PlanStep) : un objet par lap, conforme au schéma session_steps.
//     Dérivée en code par expand.ts, jamais émise par le modèle.

// ── Représentation aplatie (schéma BDD session_steps) ────────────────────────
export interface PlanStep {
  order_index: number
  step_type: "warmup" | "run" | "interval" | "recovery" | "cooldown"
  repeat_group?: number | null
  repeat_index?: number | null
  target_pace_sec?: number | null
  pace_tolerance_sec?: number | null
  distance_m?: number | null
  duration_sec?: number | null
}

// ── Représentation compacte (sortie modèle) ──────────────────────────────────
export interface CompactSimpleStep {
  step_type: "warmup" | "run" | "interval" | "recovery" | "cooldown"
  target_pace_sec?: number | null
  pace_tolerance_sec?: number | null
  distance_m?: number | null
  duration_sec?: number | null
}

export interface CompactEffort {
  target_pace_sec?: number | null
  pace_tolerance_sec?: number | null
  distance_m?: number | null
  duration_sec?: number | null
}

export interface CompactRepeat {
  repeat: number
  interval: CompactEffort
  recovery?: CompactEffort | null
}

export type CompactStep = CompactSimpleStep | CompactRepeat

// ── Séances / semaines / plan ────────────────────────────────────────────────
// PlanSession = sortie modèle : steps au format COMPACT.
export interface PlanSession {
  scheduled_date: string
  zone: "A" | "B" | "C" | "renfo"
  type: "facile" | "fractionne" | "tempo" | "sortie_longue" | "renfo"
  title: string
  rationale?: string
  steps?: CompactStep[]
  strength_content?: unknown
}

export interface PlanWeek {
  week_number: number
  block: "construction" | "intensification" | "affutage"
  focus?: string
  target_km?: number
  start_date?: string
  sessions: PlanSession[]
}

export interface GeneratedPlan {
  summary?: string
  weeks: PlanWeek[]
}

// ── Plan aplati (après expand, prêt pour persistPlan) ────────────────────────
export interface ExpandedSession extends Omit<PlanSession, "steps"> {
  steps?: PlanStep[]
}
export interface ExpandedWeek extends Omit<PlanWeek, "sessions"> {
  sessions: ExpandedSession[]
}
export interface ExpandedPlan extends Omit<GeneratedPlan, "weeks"> {
  weeks: ExpandedWeek[]
}
