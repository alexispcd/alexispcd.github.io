import type { GenerateInput } from "./types.ts"
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

export function buildUserPrompt(input: GenerateInput, todayStr: string, weeks: number): string {
  const s = input.fitness_snapshot
  const lines: string[] = [
    "Génère le plan complet pour cet athlète.",
    "",
    `Date de début (semaine 1) : ${todayStr}`,
    `Course : ${input.race.name}`,
    `Date de course : ${input.race.date}`,
    `Distance : ${(input.race.distance_m / 1000).toFixed(2)} km` +
      (input.race.elevation_m ? ` (D+ ${input.race.elevation_m} m)` : ""),
    `Nombre de semaines à couvrir : ${weeks} (week_number continu de 1 à ${weeks}, dernière semaine se terminant à la course)`,
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

  if (input.goal_time_sec) {
    lines.push("", `Objectif chrono : ${fmtTime(input.goal_time_sec)} (${input.goal_time_sec} s)`)
  }
  if (input.previous_races) {
    lines.push(`Courses précédentes : ${JSON.stringify(input.previous_races)}`)
  }
  if (input.notes) lines.push(`Remarques de l'athlète : ${input.notes}`)

  lines.push("", "Toutes les dates (start_date des semaines, scheduled_date des séances) doivent tomber entre le " +
    `${todayStr} et le ${input.race.date} inclus.`)

  return lines.join("\n")
}
