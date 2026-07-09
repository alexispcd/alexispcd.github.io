// Contrat d'entrée (POST body). La structure de plan de sortie est partagée
// dans _shared/training/types.ts.
export type { GeneratedPlan } from "../_shared/training/types.ts"

export interface GenerateInput {
  start_date?: string     // yyyy-MM-dd, début d'entraînement (>= aujourd'hui). Défaut : aujourd'hui.
  race: {
    name: string
    date: string          // yyyy-MM-dd
    distance_m: number
    elevation_m?: number
  }
  goal_time_sec?: number
  fitness_snapshot: {
    source: "coros" | "manual"
    vma_kmh: number
    threshold_pace_sec?: number
    vo2max?: number
    predictions?: Record<string, unknown>
  }
  previous_races?: unknown
  notes?: string
}
