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
 * `total` semaines, avec le contexte des semaines déjà produites pour la continuité.
 */
export function buildChunkUserPrompt(
  input: GenerateInput,
  todayStr: string,
  total: number,
  start: number,
  end: number,
  chunkStartDate: string,
  priorText: string,
): string {
  const s = input.fitness_snapshot
  const lines: string[] = [
    `Génère UNIQUEMENT les semaines ${start} à ${end} d'un plan de ${total} semaines pour cet athlète.`,
    "",
    `Date de début du plan (semaine 1) : ${todayStr}`,
    `start_date de la semaine ${start} : ${chunkStartDate}`,
    `Course : ${input.race.name} — ${input.race.date} — ${(input.race.distance_m / 1000).toFixed(2)} km` +
      (input.race.elevation_m ? ` (D+ ${input.race.elevation_m} m)` : ""),
    "",
    `Structure des blocs sur les ${total} semaines : construction → intensification → affûtage.` +
      ` L'affûtage occupe les 2-3 dernières semaines (jusqu'à la semaine ${total}, qui se termine le jour de la course).` +
      " Choisis le bloc de chaque semaine en cohérence avec cette progression et les semaines déjà générées.",
    "",
    "Semaines DÉJÀ générées (contexte de continuité — ne les régénère pas, poursuis la progression sans répéter à l'identique) :",
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
      ` Toutes les dates tombent entre le ${todayStr} et le ${input.race.date} inclus.` +
      (start === 1 ? " Renseigne aussi un \"summary\" du plan global." : " N'inclus PAS de \"summary\"."),
  )
  return lines.join("\n")
}
