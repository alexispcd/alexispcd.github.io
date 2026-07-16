import { RENFO_RULES } from "../_shared/training/methodology.ts"
import { bonusKindForWeek } from "../_shared/training/exercises.ts"

export interface RenfoTarget {
  id: string
  week_number: number
  block: string | null
}

export interface PastRenfo {
  week_number: number
  slugs: string[]
}

const bonusLabel = (wn: number): string =>
  bonusKindForWeek(wn) === "haut_corps" ? "haut_corps" : "proprioception/pied_mollets"

export function buildRenfoSystemPrompt(): string {
  return `Tu es un coach running expert. Tu régénères UNIQUEMENT le contenu de renforcement (strength_content) de plusieurs séances renfo d'un plan. Tu ne touches à rien d'autre.

${RENFO_RULES}

SORTIE :
- Réponds UNIQUEMENT avec ce JSON, commence par { et termine par } :
  { "sessions": [ { "id": "<uuid de la séance>", "strength_content": { "target_duration_min": 45, "blocks": [ ...4 blocs... ] } } ] }
- Une entrée par séance à régénérer, avec son "id" EXACT tel que fourni.
- Respecte pour CHAQUE séance : la structure 4 blocs dans l'ordre, la parité du bloc bonus selon son week_number, la progression selon son bloc de plan, et la rotation (varie les exercices d'une semaine renfo à l'autre, sans répéter les renfos déjà réalisés à l'identique).`
}

export function buildRenfoUserPrompt(
  plan: { race_name: string; race_date: string; fitness_snapshot: Record<string, unknown> | null },
  targets: RenfoTarget[],
  pastRenfos: PastRenfo[],
): string {
  const s = plan.fitness_snapshot ?? {}
  const lines: string[] = [
    `Course : ${plan.race_name} · date ${plan.race_date}`,
  ]
  if (typeof s.vma_kmh === "number") lines.push(`VMA : ${s.vma_kmh} km/h`)

  if (pastRenfos.length) {
    lines.push(
      "",
      "RENFOS DÉJÀ RÉALISÉS (pour la rotation, ne les répète pas à l'identique) :",
      ...pastRenfos.map((p) => `  · semaine ${p.week_number} : ${p.slugs.join(", ") || "(inconnu)"}`),
    )
  }

  lines.push(
    "",
    `SÉANCES RENFO À RÉGÉNÉRER (${targets.length}) :`,
    ...targets.map((t) =>
      `  · id="${t.id}" — semaine ${t.week_number} — bloc plan "${t.block ?? "?"}" — bloc bonus attendu : ${bonusLabel(t.week_number)} (semaine ${t.week_number % 2 === 1 ? "impaire" : "paire"})`,
    ),
    "",
    "Régénère le strength_content de CHACUNE de ces séances. Retourne uniquement le JSON.",
  )
  return lines.join("\n")
}
