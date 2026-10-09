// Prompts du modèle pour le module Renfo, communs à renfo-cycle et renfo-session.

import { catalogSummary, type Exercise } from "./catalog.ts"
import {
  BLOCK_CATEGORIES, COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN, DURATION_MAX_SEC, DURATION_MIN_SEC,
  KIND_LABELS, MAIN_ITEMS_MAX, MAIN_ITEMS_MIN, MAIN_REST_MAX_SEC, MAIN_REST_MIN_SEC, MAIN_SETS_MAX,
  MAIN_SETS_MIN, REPS_MAX, REPS_MIN, type SessionKind, SUPERSET_REST_MAX_SEC, SUPERSET_REST_MIN_SEC,
  SUPERSET_ROUNDS_MAX, SUPERSET_ROUNDS_MIN, WARMUP_EXTRAS, WARMUP_ITEMS_MAX, WARMUP_ITEMS_MIN,
  WEEK_PHASES,
} from "./rules.ts"

const kindRules = (kind: SessionKind): string => {
  const r = BLOCK_CATEGORIES[kind]
  const requires = r.mainRequires.map((g) => `au moins un ${g.join(" ou ")}`).join(", ")
  return `- ${kind} (${KIND_LABELS[kind]}) : bloc principal ${r.main.join(", ")}` +
    (requires ? ` (${requires})` : "") + ` ; supersets ${r.superset.join(", ")}`
}

/** Prompt système : rôle, schéma, règles, catalogue disponible et bandes du compte. */
export function buildSystemPrompt(available: Exercise[], bandsKg: number[]): string {
  const bands = bandsKg.length
    ? bandsKg.map((kg) => `${kg} kg`).join(", ")
    : "aucune (aucun exercice avec élastique n'est disponible)"
  return [
    "Tu es coach de renforcement musculaire pour un coureur à pied. Les séances se font à la maison,",
    "avec une barre de traction mobile (trois hauteurs : high en haut, mid à mi-hauteur, low en bas),",
    "des élastiques de résistances connues et une chaise, selon le matériel disponible ci-dessous.",
    "",
    "## Schéma d'une séance (champ content)",
    "{",
    '  "title": string,',
    '  "blocks": [',
    '    { "type": "warmup",   "items": [ { "slug", "reps" | "duration_sec", "band_kg"? } ] },',
    '    { "type": "main",     "items": [ { "slug", "sets", "reps" | "duration_sec", "rest_sec", "band_kg"? } ] },',
    '    { "type": "superset", "rounds", "rest_sec", "a": { "slug", "reps" | "duration_sec", "band_kg"? }, "b": { ... } },',
    '    { "type": "superset", ... },',
    '    { "type": "cooldown", "items": [ { "slug", "duration_sec" } ] }',
    "  ]",
    "}",
    "",
    "## Règles du schéma",
    `- Exactement 5 blocs dans cet ordre : échauffement (${WARMUP_ITEMS_MIN} à ${WARMUP_ITEMS_MAX} exercices, joués une fois),`,
    `  bloc principal en séries (${MAIN_ITEMS_MIN} à ${MAIN_ITEMS_MAX} exercices), deux supersets A puis B (repos après B seulement),`,
    `  retour au calme (${COOLDOWN_ITEMS_MIN} à ${COOLDOWN_ITEMS_MAX} exercices).`,
    "- reps ou duration_sec selon le mode de l'exercice (reps ou duration), jamais les deux.",
    "  Pour un exercice unilat, la valeur est par côté.",
    `- Bornes : reps ${REPS_MIN} à ${REPS_MAX}, duration_sec ${DURATION_MIN_SEC} à ${DURATION_MAX_SEC},`,
    `  sets ${MAIN_SETS_MIN} à ${MAIN_SETS_MAX} et rest_sec ${MAIN_REST_MIN_SEC} à ${MAIN_REST_MAX_SEC} pour le bloc principal,`,
    `  rounds ${SUPERSET_ROUNDS_MIN} à ${SUPERSET_ROUNDS_MAX} et rest_sec ${SUPERSET_REST_MIN_SEC} à ${SUPERSET_REST_MAX_SEC} pour un superset. Valeurs entières.`,
    "- band_kg présent si et seulement si l'exercice utilise band, égal à l'une des bandes du compte.",
    "- Aucun exercice en double dans une séance.",
    "- Échauffement : catégorie warmup, ou l'un de ces exercices : " + WARMUP_EXTRAS.join(", ") + ".",
    "- Retour au calme : catégorie cooldown uniquement.",
    "- Catégories autorisées par type de séance :",
    ...(Object.keys(KIND_LABELS) as SessionKind[]).map(kindRules),
    "- Ne renvoie pas estimated_min, la durée est calculée à part.",
    "",
    "## Choix des exercices",
    "- Choisis uniquement des slugs du catalogue ci-dessous. N'invente aucun exercice ni aucun texte d'exercice.",
    "- Échauffement ciblé sur les muscles travaillés dans la séance. Retour au calme ciblé aussi.",
    "- Séances jambes et bas du corps : privilégie le mollet excentrique (prévention du coureur), sans l'imposer.",
    "- Limite les déplacements de la barre : un superset utilise une seule hauteur de barre,",
    "  et deux hauteurs au plus sur toute la séance.",
    "",
    "## Dosage",
    "- Bloc principal : 3 à 4 séries, 60 à 120 s de repos. Supersets : 3 à 4 tours, 60 à 90 s de repos après B.",
    "- Choix des bandes : vise un effort difficile sur les dernières répétitions.",
    "  Pour un exercice assist, une bande plus forte aide davantage : la progression consiste à passer à une bande plus légère.",
    "",
    "## Cycle de 4 semaines",
    ...WEEK_PHASES.map((p, i) => `- Semaine ${i + 1}, phase ${p.phase} : ${p.instruction}`),
    "- Exercices principaux figés sur le cycle : les mêmes pour un type de séance donné sur les 4 semaines,",
    "  choisis en semaine 1. Supersets, échauffement et retour au calme varient d'une semaine à l'autre.",
    "",
    "## Matériel du compte",
    `Bandes : ${bands}.`,
    "Catalogue des exercices disponibles (slug · mode · matériel · hauteur de barre · unilat · assist · dosage de référence) :",
    catalogSummary(available),
    "",
    "## Sortie",
    'Uniquement du JSON : { "sessions": [ { "kind", "content" } ] }, une entrée par type de séance demandé, dans l\'ordre demandé.',
  ].join("\n")
}

/** Dosage compact d'un exercice : 3×10 (30 kg). */
const formatDose = (item: Record<string, unknown>): string => {
  const sets = typeof item.sets === "number" ? `${item.sets}×` : ""
  const value = item.reps != null ? `${item.reps}` : `${item.duration_sec} s`
  const band = item.band_kg != null ? ` (${item.band_kg} kg)` : ""
  return `${item.slug} ${sets}${value}${band}`
}

export interface PriorSession {
  week_index: number | null
  kind: string
  title: string
  status?: string
  content: unknown
}

const blocksOf = (content: unknown): Array<Record<string, unknown>> => {
  const blocks = (content as { blocks?: unknown })?.blocks
  return Array.isArray(blocks) ? blocks as Array<Record<string, unknown>> : []
}

/** Bloc principal d'une séance, résumé : slugs et dosages. */
export function summarizeMain(content: unknown): string {
  const main = blocksOf(content).find((b) => b.type === "main")
  const items = Array.isArray(main?.items) ? main.items as Array<Record<string, unknown>> : []
  return items.map(formatDose).join(", ")
}

/** Tous les slugs d'une séance, dans l'ordre des blocs. */
export function sessionSlugs(content: unknown): string[] {
  const slugs: string[] = []
  for (const b of blocksOf(content)) {
    if (Array.isArray(b.items)) {
      for (const item of b.items as Array<Record<string, unknown>>) slugs.push(String(item.slug))
    }
    for (const key of ["a", "b"]) {
      const dose = b[key] as Record<string, unknown> | undefined
      if (dose?.slug) slugs.push(String(dose.slug))
    }
  }
  return slugs
}

export interface CycleWeekPromptInput {
  kinds: SessionKind[]
  week: number
  /** Exercices principaux imposés par type (à partir de la semaine 2). */
  mainSlugs: Partial<Record<SessionKind, string[]>> | null
  /** Séances déjà générées dans ce cycle. */
  prior: PriorSession[]
  /** Exercices principaux du cycle précédent, à faire tourner. */
  previousMain: Partial<Record<SessionKind, string[]>> | null
}

/** Prompt utilisateur d'une semaine de cycle. */
export function buildCycleWeekPrompt(input: CycleWeekPromptInput): string {
  const phase = WEEK_PHASES[input.week - 1]
  const lines = [
    `Génère la semaine ${input.week} sur 4 du cycle, phase ${phase.phase} : ${phase.instruction}`,
    `Types de séance à produire, dans cet ordre : ${input.kinds.join(", ")}.`,
    "",
  ]
  if (input.mainSlugs) {
    lines.push("Exercices principaux imposés (bloc principal, exactement ces slugs) :")
    for (const kind of input.kinds) lines.push(`- ${kind} : ${(input.mainSlugs[kind] ?? []).join(", ")}`)
  } else {
    lines.push("Choisis les exercices principaux de chaque type : ils resteront les mêmes sur les 4 semaines du cycle.")
  }
  lines.push("", "Semaines déjà générées dans ce cycle (bloc principal par type) :")
  if (input.prior.length) {
    for (const s of input.prior) lines.push(`- Semaine ${s.week_index}, ${s.kind} : ${summarizeMain(s.content)}`)
  } else {
    lines.push("(aucune, c'est le début du cycle)")
  }
  if (input.previousMain && !input.mainSlugs) {
    lines.push("", "Exercices principaux du cycle précédent, à faire tourner (en choisir d'autres quand c'est possible) :")
    for (const [kind, slugs] of Object.entries(input.previousMain)) lines.push(`- ${kind} : ${(slugs ?? []).join(", ")}`)
  }
  lines.push("", "Réponds uniquement avec le JSON.")
  return lines.join("\n")
}

/** Prompt utilisateur d'une séance libre, hors cycle. */
export function buildFreeSessionPrompt(kind: SessionKind, weekSessions: PriorSession[]): string {
  const lines = [
    `Génère une séance libre, hors cycle, de type ${kind} (${KIND_LABELS[kind]}).`,
    "Pas d'exercices principaux imposés. Dosage proche des références du catalogue.",
    "",
    "Séances déjà prévues ou faites cette semaine (évite de répéter les mêmes exercices) :",
  ]
  if (weekSessions.length) {
    for (const s of weekSessions) {
      const status = s.status === "done" ? "faite" : "prévue"
      lines.push(`- ${s.kind} (${status}) : ${sessionSlugs(s.content).join(", ")}`)
    }
  } else {
    lines.push("(aucune)")
  }
  lines.push("", `Réponds uniquement avec le JSON, une seule entrée de type ${kind}.`)
  return lines.join("\n")
}

/** Relance après validation : erreurs regroupées par type de séance. */
export function buildRetryPrompt(errorsByKind: Array<{ kind: string; errors: string[] }>): string {
  const lines = ["Le JSON précédent est invalide. Corrige-le en respectant strictement le schéma et les règles.", ""]
  for (const { kind, errors } of errorsByKind) {
    if (!errors.length) continue
    lines.push(`Séance ${kind} :`, ...errors.slice(0, 20).map((e) => `- ${e}`))
  }
  lines.push("", "Renvoie toutes les séances demandées, corrigées, uniquement le JSON.")
  return lines.join("\n")
}
