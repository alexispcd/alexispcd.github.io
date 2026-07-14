import { TRAINING_RULES } from "../_shared/training/methodology.ts"
import { foldSteps } from "../_shared/training/expand.ts"
import type { PlanStep } from "../_shared/training/types.ts"

export interface SessionContent {
  id: string
  scheduled_date: string
  zone: string
  type: string
  title: string
  rationale: string | null
  notes: string | null
  strength_content: unknown
  steps: unknown[]
}

export interface FeedbackHistoryRow {
  scheduled_date: string
  zone: string
  type: string
  title: string
  rpe: number | null
  pain_areas: string[] | null
  feedback_note: string | null
}

/** Codes de zones de douleur (RpeForm) → libellés lisibles. */
const PAIN_LABELS: Record<string, string> = {
  mollet_g: "mollet gauche",
  mollet_d: "mollet droit",
  genou_g: "genou gauche",
  genou_d: "genou droit",
  achille_g: "tendon d'Achille gauche",
  achille_d: "tendon d'Achille droit",
  quadri_g: "cuisse gauche",
  quadri_d: "cuisse droite",
  tfl_g: "hanche/TFL gauche",
  tfl_d: "hanche/TFL droite",
  dos: "dos",
  autre: "autre",
}

function describeFeedback(r: FeedbackHistoryRow): string {
  const parts: string[] = []
  if (r.rpe != null) parts.push(`RPE ${r.rpe}/10`)
  if (r.pain_areas?.length) {
    parts.push(`douleurs : ${r.pain_areas.map((c) => PAIN_LABELS[c] ?? c).join(", ")}`)
  }
  if (r.feedback_note) parts.push(`note : ${r.feedback_note}`)
  return `  · ${r.scheduled_date} — Zone ${r.zone} / ${r.type} — "${r.title}" — ${parts.join(" · ")}`
}

export function buildAdaptSystemPrompt(): string {
  return `Tu es un coach running expert. Une séance vient d'être sautée par l'athlète ; tu ajustes UNIQUEMENT les séances suivantes de la fenêtre proche.

${TRAINING_RULES}

RÈGLES D'ADAPTATION (fenêtre glissante) :
- Séance sautée de QUALITÉ (fractionne / tempo) → préserve AU MOINS une séance de qualité dans la fenêtre, quitte à transformer une séance facile en qualité.
- Séance sautée = sortie_longue → reporte une partie du volume sur la sortie longue suivante (max +15 % distance/durée).
- Séance sautée = facile ou renfo → ne compense rien (retourne { "adapted": [] }).
- JAMAIS deux séances dures consécutives pour rattraper.
- N'augmente pas la charge de plus d'une séance à la fois.
- RESSENTI : si l'historique montre un RPE >= 8 répété, ou une même douleur sur 2 séances ou plus, RÉDUIS le volume/l'intensité des séances à venir et mentionne-le explicitement dans la justification (rationale).

SORTIE :
- Réponds UNIQUEMENT avec ce JSON, commence par { et termine par } :
  { "adapted": [ { "id": "<uuid de la séance>", "title": "...", "rationale": "...", "steps": [ ...mêmes règles de steps que ci-dessus... ] } ] }
- Pour une séance de renfo adaptée, remplace "steps" par "strength_content" (même format que ci-dessus).
- Pour une séance de COURSE adaptée, renvoie TOUJOURS le tableau "steps" complet (il remplace intégralement l'existant).
- N'inclure QUE les séances réellement modifiées. Ne modifie JAMAIS la date, la zone ni le type d'une séance.`
}

function describeSession(s: SessionContent): string {
  const base = `id="${s.id}" — ${s.scheduled_date} — Zone ${s.zone} / ${s.type} — "${s.title}"`
  // Steps présentés au format COMPACT (comme la sortie attendue).
  const content = s.type === "renfo" || s.zone === "renfo"
    ? `strength_content: ${JSON.stringify(s.strength_content)}`
    : `steps: ${JSON.stringify(foldSteps(s.steps as PlanStep[]))}`
  return `  · ${base}\n    ${content}`
}

export function buildAdaptUserPrompt(
  plan: { race_name: string; race_date: string; fitness_snapshot: Record<string, unknown> | null },
  skipped: SessionContent,
  windowSessions: SessionContent[],
  feedbackHistory: FeedbackHistoryRow[] = [],
): string {
  const s = plan.fitness_snapshot ?? {}
  const lines: string[] = [
    `Course : ${plan.race_name} — date ${plan.race_date}`,
  ]
  if (typeof s.vma_kmh === "number") lines.push(`VMA : ${s.vma_kmh} km/h`)
  if (typeof s.threshold_pace_sec === "number") lines.push(`Allure seuil : ${s.threshold_pace_sec} s/km`)

  if (feedbackHistory.length) {
    lines.push(
      "",
      "RESSENTI DES SÉANCES RÉCENTES (3 dernières semaines) :",
      ...feedbackHistory.map(describeFeedback),
    )
  }

  lines.push(
    "",
    "SÉANCE SAUTÉE :",
    describeSession(skipped),
    "",
    `SÉANCES À VENIR dans la fenêtre (candidates à adaptation, ${windowSessions.length}) :`,
    ...windowSessions.map(describeSession),
    "",
    "Adapte selon les règles. Retourne uniquement les séances réellement modifiées.",
  )
  return lines.join("\n")
}
