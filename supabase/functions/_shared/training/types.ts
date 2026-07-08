// Structure de plan produite par le modèle et partagée par generate-plan /
// regenerate-plan / adapt-sessions.

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

export interface PlanSession {
  scheduled_date: string
  zone: "A" | "B" | "C" | "renfo"
  type: "facile" | "fractionne" | "tempo" | "sortie_longue" | "renfo"
  title: string
  rationale?: string
  steps?: PlanStep[]
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
