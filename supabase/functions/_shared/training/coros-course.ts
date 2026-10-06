// Construction PURE du contenu d'une séance planifiée Coros (champ `course` de
// createScheduledWorkout / updateScheduledWorkout) à partir des session_steps
// aplatis. Aucune I/O : uniquement des fonctions exportées et testables.
//
// Schéma Coros (catalogue d'outils du serveur MCP) :
//   - course : { sportType: 1, courseName, courseDescription, sections }.
//   - section simple : sectionType (1 échauffement, 2 effort, 3 récupération,
//     4 retour au calme), targetType (1 distance en m, 2 durée en s), targetValue
//     entier positif, allure optionnelle (intensityType 2, bornes en s/km).
//   - groupe : { intervalGroup: true, repeats: 1 à 20, sets }, membres de type 2
//     ou 3 uniquement, sans imbrication, le conteneur sans cible ni intensité.

import type { PlanStep } from "./types.ts"

export const COROS_SPORT_RUN = 1
export const COROS_MAX_REPEATS = 20
export const COROS_NAME_MAX = 100
export const COROS_PACE_MIN = 120
export const COROS_PACE_MAX = 1499

const SECTION_TYPE: Record<PlanStep["step_type"], number> = {
  warmup: 1,
  run: 2,
  interval: 2,
  recovery: 3,
  cooldown: 4,
}

const TARGET_DISTANCE = 1
const TARGET_DURATION = 2
const INTENSITY_PACE = 2

const PACE_NOTE = "Les allures sont des plages en min/km."
const FALLBACK_NAME = "Séance de course"

export interface CorosSection {
  sectionType: number
  targetType: number
  targetValue: number
  intensityType?: number
  intensityValueStart?: number
  intensityValueEnd?: number
}

export interface CorosGroup {
  intervalGroup: true
  repeats: number
  sets: CorosSection[]
}

export type CorosItem = CorosSection | CorosGroup

export interface CorosCourse {
  sportType: number
  courseName: string
  courseDescription: string
  sections: CorosItem[]
}

/** Erreur de construction : la séance ne peut pas être envoyée telle quelle. */
export class CorosCourseError extends Error {}

const clampPace = (sec: number): number =>
  Math.min(COROS_PACE_MAX, Math.max(COROS_PACE_MIN, Math.round(sec)))

/**
 * Texte affiché tel quel sur la montre : sans tiret long ni emoji, espaces
 * normalisés. Les tirets cadratin et demi cadratin deviennent une virgule.
 */
export function cleanCorosText(raw: string | null | undefined): string {
  if (raw == null) return ""
  return String(raw)
    .replace(/\s*[\u2013\u2014]\s*/g, ", ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
}

/** Tronque sur les points de code (pas au milieu d'un caractère composé). */
const truncate = (s: string, max: number): string => {
  const chars = Array.from(s)
  return chars.length <= max ? s : chars.slice(0, max).join("").trimEnd()
}

export const buildCourseName = (title: string | null | undefined): string =>
  truncate(cleanCorosText(title), COROS_NAME_MAX) || FALLBACK_NAME

export function buildCourseDescription(rationale: string | null | undefined): string {
  const text = cleanCorosText(rationale)
  if (!text) return PACE_NOTE
  return /[.!?]$/.test(text) ? `${text} ${PACE_NOTE}` : `${text}. ${PACE_NOTE}`
}

/** Section simple d'un step. Lève une CorosCourseError sans distance ni durée. */
export function stepToSection(step: PlanStep): CorosSection {
  const sectionType = SECTION_TYPE[step.step_type]
  if (!sectionType) throw new CorosCourseError(`Étape de type inconnu (${step.step_type})`)

  const distance = step.distance_m != null ? Math.round(step.distance_m) : 0
  const duration = step.duration_sec != null ? Math.round(step.duration_sec) : 0
  let section: CorosSection
  if (distance > 0) {
    section = { sectionType, targetType: TARGET_DISTANCE, targetValue: distance }
  } else if (duration > 0) {
    section = { sectionType, targetType: TARGET_DURATION, targetValue: duration }
  } else {
    throw new CorosCourseError(`Étape ${step.order_index + 1} sans distance ni durée`)
  }

  if (step.target_pace_sec != null && step.target_pace_sec > 0) {
    const tol = Math.max(0, step.pace_tolerance_sec ?? 0)
    section.intensityType = INTENSITY_PACE
    section.intensityValueStart = clampPace(step.target_pace_sec - tol)
    section.intensityValueEnd = clampPace(step.target_pace_sec + tol)
  }
  return section
}

/** Découpe les steps d'un même repeat_group en répétitions (par repeat_index). */
function splitRepetitions(group: PlanStep[]): PlanStep[][] {
  const reps: PlanStep[][] = []
  let currentKey: number | null | undefined
  for (const st of group) {
    if (reps.length === 0 || st.repeat_index !== currentKey) {
      reps.push([])
      currentKey = st.repeat_index
    }
    reps[reps.length - 1].push(st)
  }
  return reps
}

/**
 * Sections d'un repeat_group : un ou plusieurs intervalGroup si toutes les
 * répétitions sont identiques (découpe par paquets de 20), sinon sections
 * dépliées (pyramide, répétition unique, membre hors effort ou récupération).
 */
function groupToItems(group: PlanStep[]): CorosItem[] {
  const flat = group.map(stepToSection)
  const reps = splitRepetitions(group).map((r) => r.map(stepToSection))
  if (reps.length < 2) return flat

  const signature = JSON.stringify(reps[0])
  const identical = reps.every((r) => JSON.stringify(r) === signature)
  const groupable = reps[0].every((s) => s.sectionType === 2 || s.sectionType === 3)
  if (!identical || !groupable) return flat

  const items: CorosItem[] = []
  for (let left = reps.length; left > 0; left -= COROS_MAX_REPEATS) {
    items.push({
      intervalGroup: true,
      repeats: Math.min(left, COROS_MAX_REPEATS),
      sets: reps[0].map((s) => ({ ...s })),
    })
  }
  return items
}

/** Sections Coros d'une liste de steps aplatis (triés par order_index ici). */
export function buildSections(steps: PlanStep[]): CorosItem[] {
  const sorted = [...steps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const items: CorosItem[] = []
  let i = 0
  while (i < sorted.length) {
    const g = sorted[i].repeat_group
    if (g == null) {
      items.push(stepToSection(sorted[i]))
      i++
      continue
    }
    const group: PlanStep[] = []
    while (i < sorted.length && sorted[i].repeat_group === g) group.push(sorted[i++])
    items.push(...groupToItems(group))
  }
  return items
}

/**
 * Contenu complet d'une séance de course pour Coros. Lève une CorosCourseError
 * si la séance n'a aucune étape ou si une étape n'a ni distance ni durée.
 */
export function buildCorosCourse(
  session: { title?: string | null; rationale?: string | null },
  steps: PlanStep[],
): CorosCourse {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new CorosCourseError("Séance sans étape")
  }
  return {
    sportType: COROS_SPORT_RUN,
    courseName: buildCourseName(session.title),
    courseDescription: buildCourseDescription(session.rationale),
    sections: buildSections(steps),
  }
}
