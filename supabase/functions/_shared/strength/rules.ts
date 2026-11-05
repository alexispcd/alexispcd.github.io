// Règles du module Renfo : thèmes des supersets et leurs catégories, groupes,
// bornes de dosage et schéma du contenu d'une séance.
// Module pur, sans import Deno ni npm : il est aussi importé par le front.

import type { Category, Exercise } from "./catalog.ts"

/** Autorisés en échauffement en plus de la catégorie warmup. */
export const WARMUP_EXTRAS: string[] = [
  "marche_laterale", "rotation_externe", "releves_pointes", "flexion_hanche_elastique",
]

/** Thème d'un superset (anciens thèmes de triset compris, lus sur les séances déjà en base). */
export type TrisetFocus =
  | "legs" | "upper" | "core_runner"
  | "lower_legs" | "posterior_calves" | "trunk"
  | "pull" | "push"
  | "quads" | "posterior" | "foot_calf"
  | "shoulders_arms"
  | "core_stability" | "balance_foot" | "runner_hips"

export const TRISET_FOCUS_LABELS: Record<TrisetFocus, string> = {
  legs: "Jambes",
  upper: "Haut du corps",
  core_runner: "Tronc",
  lower_legs: "Jambes",
  posterior_calves: "Chaîne postérieure et mollets",
  trunk: "Tronc",
  pull: "Tirage",
  push: "Poussée",
  quads: "Quadriceps",
  posterior: "Ischios et fessiers",
  foot_calf: "Pied et mollet",
  shoulders_arms: "Épaules et bras",
  core_stability: "Gainage",
  balance_foot: "Équilibre et pied",
  runner_hips: "Hanches du coureur",
}

/** Au moins `min` exercices du triset appartiennent à l'une de ces catégories. */
export interface TrisetRequirement {
  categories: Category[]
  min: number
}

export interface TrisetRules {
  categories: Category[]
  requires: TrisetRequirement[]
}

const req = (categories: Category[], min: number): TrisetRequirement => ({ categories, min })

export const TRISET_RULES: Record<TrisetFocus, TrisetRules> = {
  legs: { categories: ["legs", "posterior_chain", "calves_feet"], requires: [req(["legs"], 1)] },
  upper: { categories: ["pull", "push", "arms"], requires: [req(["pull"], 1), req(["push"], 1)] },
  core_runner: { categories: ["core", "balance", "calves_feet"], requires: [req(["core"], 1)] },
  lower_legs: { categories: ["legs", "posterior_chain"], requires: [req(["legs"], 2)] },
  posterior_calves: {
    categories: ["posterior_chain", "calves_feet"],
    requires: [req(["posterior_chain"], 1), req(["calves_feet"], 1)],
  },
  trunk: { categories: ["core", "balance"], requires: [req(["core"], 1)] },
  pull: { categories: ["pull", "arms"], requires: [req(["pull"], 2)] },
  push: { categories: ["push", "arms"], requires: [req(["push"], 2)] },
  quads: { categories: ["legs", "posterior_chain"], requires: [req(["legs"], 2)] },
  posterior: { categories: ["posterior_chain", "legs"], requires: [req(["posterior_chain"], 2)] },
  foot_calf: { categories: ["calves_feet", "balance"], requires: [req(["calves_feet"], 1)] },
  shoulders_arms: { categories: ["arms", "pull", "push"], requires: [req(["arms"], 1)] },
  core_stability: { categories: ["core", "balance"], requires: [req(["core"], 2)] },
  balance_foot: { categories: ["balance", "calves_feet"], requires: [req(["balance"], 1)] },
  runner_hips: { categories: ["posterior_chain", "core"], requires: [req(["posterior_chain"], 1)] },
}

/**
 * Règles d'un focus adaptées au catalogue disponible (matériel du compte) :
 * catégories sans exercice disponible retirées, chaque minimum ramené au nombre
 * d'exercices disponibles dans ses catégories, exigence à 0 supprimée.
 */
export function effectiveTrisetRules(focus: TrisetFocus, available: Exercise[]): TrisetRules {
  const rules = TRISET_RULES[focus]
  const count = (categories: Category[]) => available.filter((e) => categories.includes(e.category)).length
  return {
    categories: rules.categories.filter((c) => count([c]) > 0),
    requires: rules.requires
      .map((r) => ({ categories: r.categories, min: Math.min(r.min, count(r.categories)) }))
      .filter((r) => r.min > 0),
  }
}

// ── Bornes de dosage ─────────────────────────────────────────────────────────
export const REPS_MIN = 3
export const REPS_MAX = 30
export const DURATION_MIN_SEC = 10
export const DURATION_MAX_SEC = 90

// ── Structure d'une séance ───────────────────────────────────────────────────
export const WARMUP_ITEMS_MIN = 1
export const WARMUP_ITEMS_MAX = 2
export const COOLDOWN_ITEMS_MIN = 1
export const COOLDOWN_ITEMS_MAX = 2

// ── Schéma du contenu (strength_sessions.content) ────────────────────────────
// reps ou duration_sec selon le mode du catalogue, jamais les deux ; valeur par
// côté pour un exercice unilatéral. band_kg présent si et seulement si
// l'exercice utilise un élastique.

export interface Dose {
  slug: string
  reps?: number
  duration_sec?: number
  band_kg?: number
}

export interface WarmupBlock { type: "warmup"; items: Dose[] }

export interface MainItem extends Dose { sets: number; rest_sec: number }

/** Bloc principal des anciennes séances : lu et joué, plus jamais généré. */
export interface MainBlock { type: "main"; items: MainItem[] }

/** Triset A, B, C avec son focus ; les anciennes séances ont des supersets A+B sans focus. */
export interface SupersetBlock {
  type: "superset"
  rounds: number
  /** Repos après le dernier membre seulement (B, ou C pour un triset). */
  rest_sec: number
  /** Anciens formats : membres A, B, C. */
  a?: Dose
  b?: Dose
  c?: Dose
  /** Nouveau format (lot R1) : 2 à 4 exercices dans l'ordre de jeu. */
  exercises?: Dose[]
  /** Thème du triset (absent des anciens supersets). */
  focus?: TrisetFocus
}

export interface CooldownBlock { type: "cooldown"; items: Dose[] }

export type SessionBlock = WarmupBlock | MainBlock | SupersetBlock | CooldownBlock

export type BlockType = SessionBlock["type"]

export interface SessionContent {
  title: string
  /** Posé par le code (estimateSessionMinutes), jamais par le modèle. */
  estimated_min: number
  /** Nouveau format (lot R1) : intensité choisie à la composition. */
  intensity?: Intensity
  blocks: SessionBlock[]
}

// ── Séances composées (lot R1) ───────────────────────────────────────────────

export type Group = "jambes" | "haut" | "tronc"

export const GROUP_LABELS: Record<Group, string> = {
  jambes: "Jambes",
  haut: "Haut du corps",
  tronc: "Tronc",
}

/** Ordre de départage des groupes à égalité. */
export const GROUP_ORDER: Group[] = ["jambes", "tronc", "haut"]

/** Thèmes actuels de chaque groupe, dans l'ordre de départage. */
export const THEMES_BY_GROUP: Record<Group, TrisetFocus[]> = {
  jambes: ["legs", "quads", "posterior", "foot_calf"],
  haut: ["pull", "push", "shoulders_arms"],
  tronc: ["trunk", "core_stability", "balance_foot", "runner_hips"],
}

/** Thèmes proposés à la composition. */
export const CURRENT_THEMES: TrisetFocus[] = GROUP_ORDER.flatMap((g) => THEMES_BY_GROUP[g])

export const isCurrentTheme = (value: unknown): value is TrisetFocus =>
  typeof value === "string" && (CURRENT_THEMES as string[]).includes(value)

const OLD_THEME_GROUPS: Partial<Record<TrisetFocus, Group>> = {
  lower_legs: "jambes",
  posterior_calves: "jambes",
  upper: "haut",
  core_runner: "tronc",
}

/** Groupe d'un thème, anciens thèmes compris, ou null. */
export function groupOfFocus(focus: unknown): Group | null {
  if (typeof focus !== "string") return null
  for (const group of GROUP_ORDER) {
    if ((THEMES_BY_GROUP[group] as string[]).includes(focus)) return group
  }
  return OLD_THEME_GROUPS[focus as TrisetFocus] ?? null
}

export const SUPERSETS_MIN = 1
export const SUPERSETS_MAX = 4
export const SUPERSET_EXERCISES_MIN = 2
export const SUPERSET_EXERCISES_MAX = 4
export const ROUNDS_MIN = 1
export const ROUNDS_MAX = 5
/** Repos après le dernier exercice d'un superset, posé par le code. */
export const SUPERSET_REST_SEC = 60

export type Intensity = "legere" | "normale" | "soutenue"

/** Nombre de supersets par intensité, chacun de 3 exercices et 3 tours par défaut. */
export const INTENSITY_SUPERSETS: Record<Intensity, number> = {
  legere: 2,
  normale: 3,
  soutenue: 4,
}

export const isIntensity = (value: unknown): value is Intensity =>
  typeof value === "string" && Object.hasOwn(INTENSITY_SUPERSETS, value)
