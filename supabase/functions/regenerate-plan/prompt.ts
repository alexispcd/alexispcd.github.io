import { describeWeekBounds, type WeekBounds } from "../_shared/training/weeks.ts"

interface PlanRow {
  race_name: string
  race_date: string
  race_distance_m: number
  race_elevation_m: number | null
  goal_time_sec: number | null
  fitness_snapshot: Record<string, unknown> | null
  notes: string | null
}

function fmtPace(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}/km`
}

/**
 * Prompt d'un CHUNK de régénération : borne le modèle aux semaines
 * [chunkStart..chunkEnd] de la plage régénérée [currentWeek..lastWeek], avec
 * l'historique passé et les semaines déjà régénérées (continuité inter-chunks).
 * `chunkBounds` fournit les bornes calendaires (lundi→dimanche) et plages de zones.
 */
export function buildRegenChunkPrompt(
  plan: PlanRow,
  currentWeek: number,
  lastWeek: number,
  chunkStart: number,
  chunkEnd: number,
  chunkBounds: WeekBounds[],
  historyText: string,
  regeneratedText: string,
  todayStr: string,
): string {
  const s = plan.fitness_snapshot ?? {}
  const isFirstChunk = chunkStart === currentWeek

  const lines: string[] = [
    `Régénère la SUITE de ce plan : UNIQUEMENT les semaines ${chunkStart} à ${chunkEnd}` +
      ` (la plage régénérée totale va de ${currentWeek} à ${lastWeek}).`,
    `Les semaines antérieures à ${currentWeek} sont conservées telles quelles — ne les régénère PAS.`,
    "",
    `Course : ${plan.race_name}`,
    `Date de course : ${plan.race_date}`,
    `Distance : ${(plan.race_distance_m / 1000).toFixed(2)} km` +
      (plan.race_elevation_m ? ` (D+ ${plan.race_elevation_m} m)` : ""),
  ]
  if (plan.goal_time_sec) lines.push(`Objectif chrono : ${plan.goal_time_sec} s`)

  lines.push("", "Forme actuelle :")
  if (typeof s.vma_kmh === "number") lines.push(`  VMA : ${s.vma_kmh} km/h`)
  if (typeof s.threshold_pace_sec === "number") {
    lines.push(`  Allure seuil : ${fmtPace(s.threshold_pace_sec)} (${s.threshold_pace_sec} s/km)`)
  }
  if (typeof s.vo2max === "number") lines.push(`  VO2max : ${s.vo2max}`)
  if (s.predictions && typeof s.predictions === "object") {
    lines.push(`  Prédictions : ${JSON.stringify(s.predictions)}`)
  }
  if (plan.notes) lines.push(`Remarques de l'athlète : ${plan.notes}`)

  lines.push(
    "",
    "HISTORIQUE RÉEL des semaines déjà écoulées (à prendre en compte pour ajuster la charge) :",
    historyText || "  (aucune séance passée enregistrée)",
  )
  if (regeneratedText) {
    lines.push(
      "",
      "SEMAINES DÉJÀ RÉGÉNÉRÉES dans cette régénération (poursuis la progression, ne les répète pas) :",
      regeneratedText,
    )
  }

  lines.push("", "CONSIGNE D'AJUSTEMENT :")
  if (isFirstChunk) {
    lines.push(
      "- L'athlète a manqué des séances récemment. La première semaine régénérée doit être une reprise à charge réduite (intensité modérée, pas de gros fractionné), puis reprends une progression normale.",
    )
  }
  lines.push(
    "- Tiens compte des verdicts d'analyse passés (séances réussies vs à retravailler) pour recalibrer les allures.",
    "- Respecte le bloc en cours selon la proximité de la course (affûtage sur les 2-3 dernières semaines).",
    "",
    "CALENDRIER DES SEMAINES À RÉGÉNÉRER (semaines alignées lundi→dimanche). Utilise EXACTEMENT ces bornes :",
    ...chunkBounds.map((b) => describeWeekBounds(b, b.week_number === lastWeek)),
    "  Pour chaque semaine : \"start_date\" = la date de début indiquée ci-dessus. Place chaque séance dans la plage de sa zone (scheduled_date DANS la plage). Raisonne en zones, pas en jour fixe.",
    "",
    "CONTRAINTES DE SORTIE :",
    `- week_number CONTINU de ${chunkStart} à ${chunkEnd}, rien d'autre.`,
    `- Chaque scheduled_date tombe dans la plage de sa zone, entre ${todayStr} (aujourd'hui) et ${plan.race_date} inclus.`,
    "- Le champ \"summary\" est ignoré ici : tu peux l'omettre.",
  )

  return lines.join("\n")
}

/** Résumé textuel d'une semaine passée pour le contexte. */
export function formatHistory(
  weeks: Array<{ week_number: number; block: string | null; start_date: string | null }>,
  sessionsByWeek: Map<number, Array<{ zone: string; type: string; title: string; status: string; verdict: string | null }>>,
): string {
  const lines: string[] = []
  for (const w of weeks) {
    const sessions = sessionsByWeek.get(w.week_number) ?? []
    lines.push(`- Semaine ${w.week_number}${w.block ? ` (${w.block})` : ""} :`)
    for (const s of sessions) {
      const verdict = s.verdict ? `, analyse: ${s.verdict}` : ""
      lines.push(`    · Zone ${s.zone} ${s.type} "${s.title}" → ${s.status}${verdict}`)
    }
  }
  return lines.join("\n")
}
