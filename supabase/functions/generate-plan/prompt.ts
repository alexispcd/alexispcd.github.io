import type { GenerateInput } from "./types.ts"
import { describeWeekBounds, type WeekBounds } from "../_shared/training/weeks.ts"
export { buildPlanSystemPrompt as buildSystemPrompt, buildRetryPrompt } from "../_shared/training/methodology.ts"

function fmtPace(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}/km`
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}h${String(m).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`
}

export interface PriorWeek {
  week_number: number
  block: string | null
  focus: string | null
  target_km: number | null
  sessions: Array<{ zone: string; type: string; title: string }>
}

/** Résumé compact des semaines déjà générées (continuité inter-chunks). */
export function formatPriorWeeks(weeks: PriorWeek[]): string {
  if (!weeks.length) return "  (aucune — c'est le tout début du plan)"
  return weeks
    .map((w) => {
      const sess = w.sessions.map((s) => `${s.zone}/${s.type}`).join(", ")
      return `  S${w.week_number} [${w.block ?? "?"}] ${w.target_km ?? "?"} km — ${w.focus ?? ""} · ${sess}`
    })
    .join("\n")
}

/**
 * Prompt d'un CHUNK : génère seulement les semaines [start..end] d'un plan de
 * `total` semaines, alignées lundi→dimanche. `chunkBounds` fournit les bornes
 * calendaires et les plages de zones de chaque semaine du chunk.
 */
export function buildChunkUserPrompt(
  input: GenerateInput,
  planStartDate: string,
  total: number,
  start: number,
  end: number,
  chunkBounds: WeekBounds[],
  priorText: string,
): string {
  const s = input.fitness_snapshot
  const lines: string[] = [
    `Génère UNIQUEMENT les semaines ${start} à ${end} d'un plan de ${total} semaines pour cet athlète.`,
    "",
    `Début d'entraînement (semaine 1) : ${planStartDate}`,
    `Course : ${input.race.name} · ${input.race.date} · ${(input.race.distance_m / 1000).toFixed(2)} km` +
      (input.race.elevation_m ? ` (D+ ${input.race.elevation_m} m)` : ""),
    "",
    `Structure des blocs sur les ${total} semaines : construction → intensification → affûtage.` +
      ` L'affûtage occupe les 2-3 dernières semaines (jusqu'à la semaine ${total}, qui se termine le jour de la course).` +
      " Choisis le bloc de chaque semaine en cohérence avec cette progression et les semaines déjà générées.",
    "",
    "CALENDRIER DES SEMAINES À GÉNÉRER (semaines alignées lundi→dimanche). Utilise EXACTEMENT ces bornes :",
    ...chunkBounds.map((b) => describeWeekBounds(b, b.week_number === total)),
    "  Pour chaque semaine : \"start_date\" = la date de début indiquée ci-dessus. Place chaque séance dans la plage de sa zone (scheduled_date DANS la plage). Une semaine partielle ne contient que les zones listées.",
    "",
    "Semaines DÉJÀ générées (contexte de continuité, ne les régénère pas, poursuis la progression sans répéter à l'identique) :",
    priorText,
    "",
    "Forme actuelle :",
    `  Source : ${s.source}`,
    `  VMA : ${s.vma_kmh} km/h`,
  ]
  if (s.threshold_pace_sec) lines.push(`  Allure seuil : ${fmtPace(s.threshold_pace_sec)} (${s.threshold_pace_sec} s/km)`)
  if (s.vo2max) lines.push(`  VO2max : ${s.vo2max}`)
  if (s.predictions && Object.keys(s.predictions).length) {
    lines.push(`  Prédictions : ${JSON.stringify(s.predictions)}`)
  }
  if (input.goal_time_sec) lines.push("", `Objectif chrono : ${fmtTime(input.goal_time_sec)} (${input.goal_time_sec} s)`)
  if (input.previous_races) lines.push(`Courses précédentes : ${JSON.stringify(input.previous_races)}`)
  if (input.notes) lines.push(`Remarques de l'athlète : ${input.notes}`)

  lines.push(
    "",
    `Sortie : le tableau "weeks" ne contient QUE les semaines ${start} à ${end} (week_number continu de ${start} à ${end}).` +
      ` Chaque scheduled_date tombe dans la plage de sa zone (entre le ${planStartDate} et le ${input.race.date} inclus).` +
      (start === 1 ? " Renseigne aussi un \"summary\" du plan global." : " N'inclus PAS de \"summary\"."),
  )
  return lines.join("\n")
}
