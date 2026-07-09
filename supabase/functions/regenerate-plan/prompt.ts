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

export interface RegenWeekMeta {
  week_number: number
  start_date: string | null
}

/**
 * User prompt de régénération : même schéma/méthodologie que la génération
 * (system prompt partagé), mais borné aux semaines restantes et nourri de
 * l'historique réel des semaines passées.
 */
export function buildRegenUserPrompt(
  plan: PlanRow,
  firstWeek: number,
  lastWeek: number,
  regenWeeks: RegenWeekMeta[],
  historyText: string,
  todayStr: string,
): string {
  const s = plan.fitness_snapshot ?? {}
  const nbWeeks = lastWeek - firstWeek + 1

  const lines: string[] = [
    `Régénère la SUITE de ce plan : uniquement les semaines ${firstWeek} à ${lastWeek} (${nbWeeks} semaine(s)).`,
    `Les semaines antérieures à ${firstWeek} sont conservées telles quelles — ne les régénère PAS.`,
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
    "",
    "CONSIGNE D'AJUSTEMENT :",
    "- L'athlète a manqué des séances récemment. La première semaine régénérée doit être une reprise à charge réduite (intensité modérée, pas de gros fractionné), puis reprends une progression normale.",
    "- Tiens compte des verdicts d'analyse passés (séances réussies vs à retravailler) pour recalibrer les allures.",
    "- Respecte le bloc en cours selon la proximité de la course (affûtage sur les 2-3 dernières semaines).",
    "",
    "CONTRAINTES DE SORTIE :",
    `- week_number CONTINU de ${firstWeek} à ${lastWeek}, rien d'autre.`,
    "- Réutilise EXACTEMENT ces start_date par semaine :",
    ...regenWeeks.map((w) => `    semaine ${w.week_number} → start_date ${w.start_date ?? "(à calculer, lundi de la semaine)"}`),
    `- Toutes les scheduled_date des séances doivent être comprises entre ${todayStr} (aujourd'hui) et ${plan.race_date} inclus.`,
    "- Le champ \"summary\" est ignoré ici : tu peux l'omettre.",
  )

  return lines.join("\n")
}

/**
 * Prompt d'un CHUNK de régénération : borne le modèle aux semaines
 * [chunkStart..chunkEnd] de la plage régénérée [currentWeek..lastWeek], avec
 * l'historique passé et les semaines déjà régénérées (continuité inter-chunks).
 */
export function buildRegenChunkPrompt(
  plan: PlanRow,
  currentWeek: number,
  lastWeek: number,
  chunkStart: number,
  chunkEnd: number,
  chunkWeeks: RegenWeekMeta[],
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
    "CONTRAINTES DE SORTIE :",
    `- week_number CONTINU de ${chunkStart} à ${chunkEnd}, rien d'autre.`,
    "- Réutilise EXACTEMENT ces start_date par semaine :",
    ...chunkWeeks.map((w) => `    semaine ${w.week_number} → start_date ${w.start_date ?? "(à calculer, lundi de la semaine)"}`),
    `- Toutes les scheduled_date des séances doivent être comprises entre ${todayStr} (aujourd'hui) et ${plan.race_date} inclus.`,
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
