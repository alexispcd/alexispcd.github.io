// Choix des exercices d'une séance composée (lot R1), réservé aux Edge Functions.
// Le modèle ne choisit que les exercices, et l'élastique d'un exercice sans base :
// dose, tours, repos, titre et durée sont posés par compose.ts.

import { anthropicSimple, type AnthropicMessage } from "../anthropic.ts"
import { extractJson } from "../extract-json.ts"
import { catalogSummary, type Exercise } from "./catalog.ts"
import {
  bandeDemandee, type Choix, type ChoixContexte, type Demande, type DoneSession, exercicesRecents,
  exigencesDuSuperset, validerChoix,
} from "./compose.ts"
import { MODEL } from "./generate.ts"
import { barHeightsSummary } from "./prompt.ts"
import {
  COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN, effectiveTrisetRules, type Group, GROUP_LABELS,
  TRISET_FOCUS_LABELS, WARMUP_EXTRAS, WARMUP_ITEMS_MAX, WARMUP_ITEMS_MIN,
} from "./rules.ts"

const MAX_TOKENS = 2000
const CALL_TIMEOUT_MS = 70_000

/** Prompt système : règles, catalogue disponible, bandes, hauteurs de barre, exercices avec base. */
export function buildChoixSystemPrompt(available: Exercise[], bandsKg: number[], avecBase: string[]): string {
  const bands = bandsKg.length
    ? bandsKg.map((kg) => `${kg} kg`).join(", ")
    : "aucune (aucun exercice avec élastique n'est disponible)"
  const bases = avecBase.filter((slug) => available.some((e) => e.slug === slug))
  return [
    "Tu es coach de renforcement musculaire pour un coureur à pied. Les séances se font à la maison,",
    "avec une barre de traction mobile (trois hauteurs : high en haut, mid à mi-hauteur, low en bas),",
    "des élastiques de résistances connues et une chaise, selon le matériel disponible ci-dessous.",
    "",
    "## Ton rôle",
    "Tu choisis uniquement les exercices d'une séance déjà composée : nombre de supersets, thème et",
    "nombre d'exercices de chacun sont fixés. Ne donne aucune dose, aucun nombre de tours, aucun repos,",
    "aucun titre : ils sont calculés à part.",
    "",
    "## Règles",
    "- Choisis uniquement des slugs du catalogue ci-dessous. N'invente aucun exercice.",
    "- Chaque superset : exactement le nombre d'exercices demandé, dans les catégories autorisées",
    "  de son thème, en respectant ses exigences (minimums par catégorie).",
    "- Aucun exercice en double dans la séance, exercices déjà gardés compris.",
    `- Échauffement : ${WARMUP_ITEMS_MIN} à ${WARMUP_ITEMS_MAX} exercices, catégorie warmup ou l'un de ces exercices :`,
    `  ${WARMUP_EXTRAS.join(", ")}. Court et ciblé sur les groupes travaillés dans la séance.`,
    `- Retour au calme : ${COOLDOWN_ITEMS_MIN} à ${COOLDOWN_ITEMS_MAX} exercices, catégorie cooldown uniquement,`,
    "  ciblé sur les groupes travaillés.",
    "- Barre : un superset utilise une seule hauteur de barre, deux hauteurs au plus sur toute la séance",
    "  (échauffement, exercices gardés et retour au calme compris). Règle stricte, vérifiée.",
    "- band_kg : seulement pour un exercice à élastique (band) absent de la liste des exercices",
    "  qui ont déjà un réglage, égal à l'une des bandes du compte. Vise un effort difficile sur les",
    "  dernières répétitions ; pour un exercice assist, une bande plus forte aide davantage.",
    "  Pour tout autre exercice, ne renvoie que le slug.",
    "",
    "## Matériel du compte",
    `Bandes : ${bands}.`,
    "Catalogue des exercices disponibles (slug · mode · matériel · hauteur de barre · unilat · assist · dosage de référence) :",
    catalogSummary(available),
    ...barHeightsSummary(available),
    "",
    "Exercices qui ont déjà un réglage (aucun band_kg pour eux) :",
    bases.length ? bases.join(", ") : "(aucun)",
    "",
    "## Sortie",
    "Uniquement du JSON :",
    '{ "warmup": [{ "slug" }], "supersets": [ { "position": n, "exercises": [{ "slug", "band_kg"? }] } ], "cooldown": [{ "slug" }] }',
    "warmup et cooldown seulement s'ils sont demandés ; supersets dans l'ordre des positions demandées.",
  ].join("\n")
}

export interface ChoixPromptInput {
  demande: Demande
  /** Groupes de toute la séance, pour cibler échauffement et retour au calme. */
  groupes: Group[]
  gardes: string[]
  available: Exercise[]
  /** Séances faites récentes, pour les exercices à éviter. */
  recentes: DoneSession[]
}

/** Prompt utilisateur : supersets à remplir, exercices gardés, exercices récents à éviter. */
export function buildChoixUserPrompt(input: ChoixPromptInput): string {
  const lines = ["Supersets à remplir :"]
  for (const s of input.demande.supersets) {
    const rules = effectiveTrisetRules(s.focus, input.available)
    const requires = exigencesDuSuperset(s.focus, s.exercise_count, input.available)
      .map((r) => `au moins ${r.min} ${r.categories.join(" ou ")}`)
      .join(", ")
    lines.push(
      `- position ${s.position}, thème ${s.focus} (${TRISET_FOCUS_LABELS[s.focus]}), ${s.exercise_count} exercices, ` +
        `catégories ${rules.categories.join(", ")}${requires ? `, exigences : ${requires}` : ""}`,
    )
  }
  lines.push("", `Groupes travaillés dans la séance : ${input.groupes.map((g) => GROUP_LABELS[g]).join(", ")}.`)
  lines.push(
    input.demande.echauffement
      ? "Choisis aussi l'échauffement et le retour au calme."
      : "Échauffement et retour au calme sont gardés : ne les renvoie pas.",
  )
  lines.push("", "Exercices déjà gardés sur la séance (ne les reprends pas) :")
  lines.push(input.gardes.length ? input.gardes.join(", ") : "(aucun)")
  const recents = input.demande.supersets
    .map((s) => [s.focus, exercicesRecents(s.focus, input.recentes)] as const)
    .filter(([, slugs]) => slugs.length)
  if (recents.length) {
    lines.push("", "Exercices de la dernière séance faite sur chaque thème, à éviter quand tu as le choix, sans obligation :")
    for (const [focus, slugs] of recents) lines.push(`- ${focus} : ${slugs.join(", ")}`)
  }
  lines.push("", "Réponds uniquement avec le JSON.")
  return lines.join("\n")
}

const buildRetry = (errors: string[]): string =>
  [
    "Le JSON précédent est invalide. Corrige-le en respectant strictement les règles.",
    "",
    ...errors.slice(0, 20).map((e) => `- ${e}`),
    "",
    "Renvoie le choix complet corrigé, uniquement le JSON.",
  ].join("\n")

const check = (raw: string, ctx: ChoixContexte): { choix: Choix | null; errors: string[] } => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    return { choix: null, errors: ["JSON illisible"] }
  }
  const errors = validerChoix(parsed, ctx)
  if (errors.length) return { choix: null, errors }
  const p = parsed as Choix
  // Ne garde que ce qui a été demandé : band_kg des seuls exercices sans base.
  const clean = (items: Array<{ slug: string; band_kg?: number }>) =>
    items.map(({ slug, band_kg }) => bandeDemandee(slug, ctx.avecBase) ? { slug, band_kg } : { slug })
  return {
    choix: {
      warmup: ctx.demande.echauffement ? clean(p.warmup ?? []) : undefined,
      cooldown: ctx.demande.echauffement ? clean(p.cooldown ?? []) : undefined,
      supersets: ctx.demande.supersets.map((d) => ({
        position: d.position,
        exercises: clean(p.supersets.find((s) => s.position === d.position)?.exercises ?? []),
      })),
    },
    errors: [],
  }
}

export type ChoixResult = { ok: true; choix: Choix } | { ok: false; errors: string[] }

/** Appel du modèle, contrôle par validerChoix, un seul retry avec la liste des erreurs. */
export async function choisirExercices(
  ctx: ChoixContexte & { groupes: Group[]; recentes: DoneSession[]; logTag: string },
): Promise<ChoixResult> {
  const system = buildChoixSystemPrompt(ctx.available, ctx.bandsKg, ctx.avecBase)
  const messages: AnthropicMessage[] = [{ role: "user", content: buildChoixUserPrompt(ctx) }]
  const call = () =>
    anthropicSimple({ model: MODEL, max_tokens: MAX_TOKENS, system, messages, timeoutMs: CALL_TIMEOUT_MS })

  const first = await call()
  let result = check(first, ctx)
  if (result.choix) return { ok: true, choix: result.choix }

  console.warn(`${ctx.logTag} choix à corriger (essai 1) :`, JSON.stringify(result.errors).slice(0, 2000))
  messages.push({ role: "assistant", content: first }, { role: "user", content: buildRetry(result.errors) })
  result = check(await call(), ctx)
  if (result.choix) return { ok: true, choix: result.choix }
  return { ok: false, errors: result.errors }
}
