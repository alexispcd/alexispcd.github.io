// Règles du module Renfo : types de séance, catégories autorisées par bloc,
// phases du cycle, bornes de dosage et schéma du contenu d'une séance.
// Module pur, sans import Deno ni npm : il est aussi importé par le front.

import type { Category } from "./catalog.ts"

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

export interface BlockRules {
  main: Category[]
  superset: Category[]
  /** Chaque groupe doit être représenté par au moins un exercice du bloc principal. */
  mainRequires: Category[][]
}

export const BLOCK_CATEGORIES: Record<SessionKind, BlockRules> = {
  full: {
    main: ["legs", "posterior_chain", "pull", "push"],
    superset: ["core", "arms", "calves_feet", "posterior_chain"],
    mainRequires: [["legs", "posterior_chain"], ["pull", "push"]],
  },
  lower_core: {
    main: ["legs", "posterior_chain"],
    superset: ["core", "posterior_chain", "calves_feet", "balance"],
    mainRequires: [],
  },
  upper_core: {
    main: ["pull", "push"],
    superset: ["core", "arms", "pull", "push"],
    mainRequires: [],
  },
  legs: {
    main: ["legs", "posterior_chain"],
    superset: ["legs", "posterior_chain", "calves_feet"],
    mainRequires: [],
  },
  upper: {
    main: ["pull", "push"],
    superset: ["arms", "pull", "push"],
    mainRequires: [["pull"]],
  },
  core_runner: {
    main: ["core"],
    superset: ["core", "balance", "calves_feet"],
    mainRequires: [],
  },
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
    instruction: "Une ou deux répétitions ou une série de plus sur le bloc principal par rapport à la semaine 1.",
  },
  { phase: "pic", instruction: "Volume maximal du cycle ou bande plus exigeante." },
  {
    phase: "decharge",
    instruction: "Une série de moins et environ 30 % de volume en moins, mêmes exercices principaux.",
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
export const MAIN_SETS_MIN = 2
export const MAIN_SETS_MAX = 5
export const MAIN_REST_MIN_SEC = 45
export const MAIN_REST_MAX_SEC = 180
export const SUPERSET_ROUNDS_MIN = 2
export const SUPERSET_ROUNDS_MAX = 4
export const SUPERSET_REST_MIN_SEC = 45
export const SUPERSET_REST_MAX_SEC = 120

// ── Structure d'une séance ───────────────────────────────────────────────────
export const WARMUP_ITEMS_MIN = 3
export const WARMUP_ITEMS_MAX = 4
export const MAIN_ITEMS_MIN = 2
export const MAIN_ITEMS_MAX = 3
export const COOLDOWN_ITEMS_MIN = 3
export const COOLDOWN_ITEMS_MAX = 4

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

export interface MainBlock { type: "main"; items: MainItem[] }

export interface SupersetBlock {
  type: "superset"
  rounds: number
  /** Repos après B seulement. */
  rest_sec: number
  a: Dose
  b: Dose
}

export interface CooldownBlock { type: "cooldown"; items: Dose[] }

export type SessionBlock = WarmupBlock | MainBlock | SupersetBlock | CooldownBlock

/** Ordre exact des 5 blocs. */
export const BLOCK_ORDER = ["warmup", "main", "superset", "superset", "cooldown"] as const

export interface SessionContent {
  title: string
  /** Posé par le code (estimateSessionMinutes), jamais par le modèle. */
  estimated_min: number
  blocks: SessionBlock[]
}
