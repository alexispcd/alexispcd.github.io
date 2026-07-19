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

// ── Renfo (musculation) ──────────────────────────────────────────────────────
// Format CIRCUIT : un bloc est une liste d'exercices enchaînés, l'ensemble étant
// répété `rounds` fois. Les repos ne sont plus portés par l'exercice, ils sont
// déterministes et définis dans strength.ts.
//
// Sortie modèle : chaque exercice porte un `slug` du catalogue (exercises.ts) +
// reps OU duration_sec. Le code enrichit ensuite name / description / category /
// equipment / unilateral depuis le catalogue.
export interface StrengthExercise {
  slug: string
  reps?: number | null
  duration_sec?: number | null
  // Blocs HISTORIQUES uniquement (plans générés avant le format circuit) :
  // séries et repos portés par l'exercice. Le modèle ne les émet plus.
  sets?: number
  rest_sec?: number
  // Champs résolus à l'enrichissement (persistance) :
  name?: string
  description?: string
  category?: string
  equipment?: string
  unilateral?: boolean
}

export interface StrengthBlock {
  theme: string
  /** Nombre de tours du circuit. Absent = bloc historique (sets / rest_sec). */
  rounds?: number
  exercises: StrengthExercise[]
}

export interface StrengthContent {
  target_duration_min: number
  blocks: StrengthBlock[]
  // Base complète (~45 min) figée à la persistance, source de la recomposition.
  base_blocks?: StrengthBlock[]
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
