// Prompts du modèle pour le module Renfo, communs à renfo-cycle et renfo-session.

import { catalogSummary, type Exercise } from "./catalog.ts"
import {
  blockOrder, COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN, DURATION_MAX_SEC, DURATION_MIN_SEC,
  effectiveTrisetRules, KIND_LABELS, REPS_MAX, REPS_MIN, type SessionKind, SUPERSET_REST_MAX_SEC,
  SUPERSET_REST_MIN_SEC, SUPERSET_ROUNDS_MAX, SUPERSET_ROUNDS_MIN, TRISETS_BY_KIND, type TrisetRequirement,
  WARMUP_EXTRAS, WARMUP_ITEMS_MAX, WARMUP_ITEMS_MIN, WEEK_PHASES,
} from "./rules.ts"

const requiresText = (requires: TrisetRequirement[]): string =>
  requires.map((r) => `au moins ${r.min} ${r.categories.join(" ou ")}`).join(", ")

/** Trisets d'un type, dans l'ordre, avec les catégories et exigences effectives (matériel du compte). */
const kindRules = (kind: SessionKind, available: Exercise[]): string => {
  const trisets = TRISETS_BY_KIND[kind].map((focus, i) => {
    const t = effectiveTrisetRules(focus, available)
    const requires = requiresText(t.requires)
    return `triset ${i + 1} focus ${focus} : ${t.categories.join(", ")}${requires ? ` (${requires})` : ""}`
  })
  return `- ${kind} (${KIND_LABELS[kind]}) : ${trisets.join(" ; ")}`
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
    "## Schéma d'une séance (champ content), identique pour tous les types",
    "{",
    '  "title": string,',
    '  "blocks": [',
    '    { "type": "warmup",   "items": [ { "slug", "reps" | "duration_sec", "band_kg"? } ] },',
    '    { "type": "superset", "focus", "rounds", "rest_sec",',
    '      "a": { "slug", "reps" | "duration_sec", "band_kg"? }, "b": { ... }, "c": { ... } },',
    '    { "type": "superset", "focus", ... },',
    '    { "type": "superset", "focus", ... },',
    '    { "type": "cooldown", "items": [ { "slug", "duration_sec" } ] }',
    "  ]",
    "}",
    "",
    "## Règles du schéma",
    `- Exactement 5 blocs dans cet ordre : ${blockOrder("full").join(", ")}.`,
    "- Chaque superset est un triset : a, b et c enchaînés, repos après c seulement, avec le focus",
    "  attendu à sa position pour le type de séance (voir plus bas).",
    `- Échauffement : ${WARMUP_ITEMS_MIN} à ${WARMUP_ITEMS_MAX} exercices, joués une fois, vise ${WARMUP_ITEMS_MAX}.`,
    `  Retour au calme : ${COOLDOWN_ITEMS_MIN} à ${COOLDOWN_ITEMS_MAX} exercices, vise ${COOLDOWN_ITEMS_MAX}.`,
    "- reps ou duration_sec selon le mode de l'exercice (reps ou duration), jamais les deux.",
    "  Pour un exercice unilat, la valeur est par côté.",
    `- Bornes : reps ${REPS_MIN} à ${REPS_MAX}, duration_sec ${DURATION_MIN_SEC} à ${DURATION_MAX_SEC},`,
    `  rounds ${SUPERSET_ROUNDS_MIN} à ${SUPERSET_ROUNDS_MAX} et rest_sec ${SUPERSET_REST_MIN_SEC} à ${SUPERSET_REST_MAX_SEC} pour un triset. Valeurs entières.`,
    "- band_kg présent si et seulement si l'exercice utilise band, égal à l'une des bandes du compte.",
    "- Aucun exercice en double dans une séance.",
    "- Échauffement : catégorie warmup, ou l'un de ces exercices : " + WARMUP_EXTRAS.join(", ") + ".",
    "- Retour au calme : catégorie cooldown uniquement.",
    "- Trisets de chaque type de séance, dans l'ordre (focus, catégories autorisées, exigences) :",
    ...(Object.keys(KIND_LABELS) as SessionKind[]).map((kind) => kindRules(kind, available)),
    "- Ne renvoie pas estimated_min, la durée est calculée à part.",
    "",
    "## Choix des exercices",
    "- Choisis uniquement des slugs du catalogue ci-dessous. N'invente aucun exercice ni aucun texte d'exercice.",
    "- Échauffement court et ciblé sur les muscles travaillés dans la séance. Retour au calme ciblé aussi.",
    "- Triset foot_calf et triset legs du corps complet : privilégie le mollet excentrique (prévention du coureur), sans l'imposer.",
    "- Limite les déplacements de la barre : un triset utilise une seule hauteur de barre,",
    "  et deux hauteurs au plus sur toute la séance.",
    "",
    "## Dosage",
    "- Trisets : 3 à 4 tours, 60 à 90 s de repos après C.",
    "- Choix des bandes : vise un effort difficile sur les dernières répétitions.",
    "  Pour un exercice assist, une bande plus forte aide davantage : la progression consiste à passer à une bande plus légère.",
    "",
    "## Cycle de 4 semaines",
    ...WEEK_PHASES.map((p, i) => `- Semaine ${i + 1}, phase ${p.phase} : ${p.instruction}`),
    "- Pour tous les types, les 9 exercices des trisets sont figés sur le cycle, chacun dans son triset,",
    "  choisis à la première semaine générée ; seul leur dosage progresse.",
    "  Échauffement et retour au calme varient chaque semaine.",
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

/** Dosage compact d'un exercice : 10 (30 kg), ou 3×10 pour une ancienne série. */
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

/** Résumé d'un superset ou d'un triset : 3×(a 10, b 12 (15 kg), c 30 s). */
const summarizeSuperset = (block: Record<string, unknown>): string => {
  const members = ["a", "b", "c"]
    .map((key) => block[key] as Record<string, unknown> | undefined)
    .filter((dose): dose is Record<string, unknown> => !!dose?.slug)
  return `${block.rounds}×(${members.map(formatDose).join(", ")})`
}

/**
 * Exercices figés d'une séance, résumés avec leur dosage : les trisets. Repli sur le
 * bloc principal pour une ancienne séance, qui peut figurer dans l'historique.
 */
export function summarizeMain(content: unknown): string {
  const blocks = blocksOf(content)
  const trisets = blocks.filter((b) => b.type === "superset" && (b.focus || b.c))
  if (trisets.length) {
    return trisets.map((b, i) => `triset ${i + 1}${b.focus ? ` ${b.focus}` : ""} ${summarizeSuperset(b)}`).join(" ; ")
  }
  const main = blocks.find((b) => b.type === "main")
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
    for (const key of ["a", "b", "c"]) {
      const dose = b[key] as Record<string, unknown> | undefined
      if (dose?.slug) slugs.push(String(dose.slug))
    }
  }
  return slugs
}

export interface CycleWeekPromptInput {
  kinds: SessionKind[]
  week: number
  /** Exercices figés par type (lockedSlugs), pour les types qui en ont déjà. */
  mainSlugs: Partial<Record<SessionKind, string[]>> | null
  /** Séances déjà générées dans ce cycle. */
  prior: PriorSession[]
  /** Exercices figés du cycle précédent, à faire tourner. */
  previousMain: Partial<Record<SessionKind, string[]>> | null
}

/** Consigne d'exercices imposés pour un type, triset par triset. */
const lockedLine = (kind: SessionKind, slugs: string[]): string => {
  const trisets = [0, 1, 2].map((i) => `triset ${i + 1} : ${slugs.slice(i * 3, i * 3 + 3).join(", ")}`)
  return `- ${kind} (trisets, exactement ces slugs dans chaque triset, ordre libre) : ${trisets.join(" ; ")}`
}

/** Prompt utilisateur d'une semaine de cycle. */
export function buildCycleWeekPrompt(input: CycleWeekPromptInput): string {
  const phase = WEEK_PHASES[input.week - 1]
  const lines = [
    `Génère la semaine ${input.week} sur 4 du cycle, phase ${phase.phase} : ${phase.instruction}`,
    `Types de séance à produire, dans cet ordre : ${input.kinds.join(", ")}.`,
    "",
  ]
  const locked = input.kinds.filter((k) => input.mainSlugs?.[k]?.length)
  const free = input.kinds.filter((k) => !locked.includes(k))
  if (locked.length) {
    lines.push("Exercices figés imposés pour ce cycle :")
    for (const kind of locked) lines.push(lockedLine(kind, input.mainSlugs![kind]!))
  }
  if (free.length) {
    if (locked.length) lines.push("")
    lines.push(
      `Choisis les 9 exercices des trisets de ${free.join(", ")} :`,
      "ils resteront les mêmes jusqu'à la fin du cycle, seul leur dosage progressera.",
    )
  }
  lines.push("", "Semaines déjà générées dans ce cycle (exercices figés par type) :")
  if (input.prior.length) {
    for (const s of input.prior) lines.push(`- Semaine ${s.week_index}, ${s.kind} : ${summarizeMain(s.content)}`)
  } else {
    lines.push("(aucune, c'est le début du cycle)")
  }
  const previous = Object.entries(input.previousMain ?? {}).filter(([kind]) => free.includes(kind as SessionKind))
  if (previous.length) {
    lines.push("", "Exercices figés du cycle précédent, à faire tourner (en choisir d'autres quand c'est possible) :")
    for (const [kind, slugs] of previous) lines.push(`- ${kind} : ${(slugs ?? []).join(", ")}`)
  }
  lines.push("", "Réponds uniquement avec le JSON.")
  return lines.join("\n")
}

/** Prompt utilisateur d'une séance libre, hors cycle. */
export function buildFreeSessionPrompt(kind: SessionKind, weekSessions: PriorSession[]): string {
  const lines = [
    `Génère une séance libre, hors cycle, de type ${kind} (${KIND_LABELS[kind]}).`,
    "Pas d'exercices imposés. Dosage proche des références du catalogue.",
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
