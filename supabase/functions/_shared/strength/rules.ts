// Règles du module Renfo : types de séance, trisets et leurs catégories,
// phases du cycle, bornes de dosage et schéma du contenu d'une séance.
// Module pur, sans import Deno ni npm : il est aussi importé par le front.

import type { Category, Exercise } from "./catalog.ts"

export type SessionKind = "full" | "lower_core" | "upper_core" | "legs" | "upper" | "core_runner"

export const KIND_LABELS: Record<SessionKind, string> = {
  full: "Corps complet",
  lower_core: "Bas du corps et tronc",
  upper_core: "Haut du corps et tronc",
  legs: "Jambes",
  upper: "Haut du corps",
  core_runner: "Tronc et coureur",
}

export const SESSION_KINDS = Object.keys(KIND_LABELS) as SessionKind[]

export const isSessionKind = (value: unknown): value is SessionKind =>
  typeof value === "string" && (SESSION_KINDS as string[]).includes(value)

/** Types de séance d'une semaine de cycle, dans l'ordre de position. */
export const KINDS_BY_FREQUENCY: Record<1 | 2 | 3, SessionKind[]> = {
  1: ["full"],
  2: ["lower_core", "upper_core"],
  3: ["legs", "upper", "core_runner"],
}

/** Types proposés pour une séance libre. */
export const FREE_KINDS: SessionKind[] = ["full", "legs", "upper", "core_runner"]

/** Autorisés en échauffement en plus de la catégorie warmup. */
export const WARMUP_EXTRAS: string[] = [
  "marche_laterale", "rotation_externe", "releves_pointes", "flexion_hanche_elastique",
]

/** Thème d'un triset. */
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
  core_runner: "Tronc et coureur",
  lower_legs: "Jambes",
  posterior_calves: "Chaîne postérieure et mollets",
  trunk: "Tronc",
  pull: "Tirage",
  push: "Poussée",
  quads: "Quadriceps",
  posterior: "Chaîne postérieure",
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

/** Trisets de chaque type de séance, dans l'ordre : le triset n vaut TRISETS_BY_KIND[kind][n - 1]. */
export const TRISETS_BY_KIND: Record<SessionKind, TrisetFocus[]> = {
  full: ["legs", "upper", "core_runner"],
  lower_core: ["lower_legs", "posterior_calves", "trunk"],
  upper_core: ["pull", "push", "trunk"],
  legs: ["quads", "posterior", "foot_calf"],
  upper: ["pull", "push", "shoulders_arms"],
  core_runner: ["core_stability", "balance_foot", "runner_hips"],
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

export type WeekPhase = "base" | "progression" | "pic" | "decharge"

export interface WeekPhaseRule {
  phase: WeekPhase
  instruction: string
}

/** Phases des semaines 1 à 4 d'un cycle (index 0 = semaine 1). */
export const WEEK_PHASES: WeekPhaseRule[] = [
  { phase: "base", instruction: "Dosage prudent, proche des références du catalogue." },
  {
    phase: "progression",
    instruction: "Une ou deux répétitions, ou un tour de plus, sur les trisets par rapport à la semaine 1.",
  },
  { phase: "pic", instruction: "Volume maximal du cycle ou bande plus exigeante." },
  {
    phase: "decharge",
    instruction: "Un tour de moins et environ 30 % de volume en moins, mêmes exercices.",
  },
]

/** Libellés d'affichage des phases. */
export const PHASE_LABELS: Record<WeekPhase, string> = {
  base: "Base",
  progression: "Progression",
  pic: "Pic",
  decharge: "Décharge",
}

// ── Bornes de dosage ─────────────────────────────────────────────────────────
export const REPS_MIN = 3
export const REPS_MAX = 30
export const DURATION_MIN_SEC = 10
export const DURATION_MAX_SEC = 90
export const SUPERSET_ROUNDS_MIN = 2
export const SUPERSET_ROUNDS_MAX = 4
export const SUPERSET_REST_MIN_SEC = 45
export const SUPERSET_REST_MAX_SEC = 120

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
  a: Dose
  b: Dose
  c?: Dose
  /** Thème du triset (absent des anciens supersets). */
  focus?: TrisetFocus
}

export interface CooldownBlock { type: "cooldown"; items: Dose[] }

export type SessionBlock = WarmupBlock | MainBlock | SupersetBlock | CooldownBlock

export type BlockType = SessionBlock["type"]

const TRISET_ORDER: BlockType[] = ["warmup", "superset", "superset", "superset", "cooldown"]

/** Ordre exact des blocs d'une séance générée : identique pour tous les types. */
export const blockOrder = (_kind: SessionKind): BlockType[] => TRISET_ORDER

export interface SessionContent {
  title: string
  /** Posé par le code (estimateSessionMinutes), jamais par le modèle. */
  estimated_min: number
  blocks: SessionBlock[]
}

const slugOf = (dose: unknown): string | null => {
  const slug = (dose as { slug?: unknown } | null | undefined)?.slug
  return typeof slug === "string" ? slug : null
}

/**
 * Exercices figés sur un cycle : les 9 slugs des trisets à plat (triset 1 A, B, C,
 * puis triset 2, puis triset 3), pour tous les types de séance.
 */
export function lockedSlugs(_kind: SessionKind, content: unknown): string[] {
  const blocks = (content as { blocks?: unknown } | null)?.blocks
  if (!Array.isArray(blocks)) return []
  const slugs: (string | null)[] = []
  for (const block of blocks) {
    if (block?.type === "superset") slugs.push(slugOf(block.a), slugOf(block.b), slugOf(block.c))
  }
  return slugs.filter((s): s is string => s !== null)
}
