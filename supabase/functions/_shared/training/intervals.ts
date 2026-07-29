// Mapping PUR des steps de course (schema session_steps aplati) vers le format
// texte de description d'un workout Intervals.icu. Aucune I/O reseau ni base :
// uniquement des fonctions exportees et testables.
//
// Format cible (workout builder Intervals.icu, cf. forum "Uploading planned
// workouts to Intervals.icu") : une ligne par step commencant par "- ", les
// blocs repetes introduits par une ligne "Nx" suivie des steps du bloc indentes.
// Les allures sont absolues en /km, exprimees en plage [allure - tolerance,
// allure + tolerance]. Un step sans allure cible reste en allure libre.

import type { PlanStep } from "./types.ts"

const INDENT = "  "

/** Deux chiffres, pour les secondes d'une allure ou d'une duree. */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Duree en secondes vers un token Intervals.icu : 1h, 10m, 45s, 5m30s. */
export function formatDurationToken(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  let out = ""
  if (h) out += `${h}h`
  if (m) out += `${m}m`
  if (r || !out) out += `${r}s`
  return out
}

/** Distance en metres vers un token : 400m, 1km, 1.5km (zeros de fin retires). */
export function formatDistanceToken(m: number): string {
  const meters = Math.max(0, Math.round(m))
  if (meters >= 1000) {
    const km = meters / 1000
    const txt = km.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
    return `${txt}km`
  }
  return `${meters}m`
}

/** Allure en secondes par km vers mm:ss. */
export function formatPace(paceSec: number): string {
  const s = Math.max(0, Math.round(paceSec))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}

/**
 * Cible d'allure absolue en /km. Avec une tolerance, on exprime une plage
 * [allure - tolerance, allure + tolerance] : la borne rapide (secondes plus
 * basses) d'abord. Sans allure cible, retourne null (allure libre).
 */
export function paceTarget(
  paceSec: number | null | undefined,
  tolSec: number | null | undefined,
): string | null {
  if (paceSec == null) return null
  if (tolSec != null && tolSec > 0) {
    return `${formatPace(paceSec - tolSec)}-${formatPace(paceSec + tolSec)}/km`
  }
  return `${formatPace(paceSec)}/km`
}

/** Borne d'un step : distance si renseignee, sinon duree. Null si aucune. */
export function sizeToken(step: PlanStep): string | null {
  if (step.distance_m != null) return formatDistanceToken(step.distance_m)
  if (step.duration_sec != null) return formatDurationToken(step.duration_sec)
  return null
}

/** Ligne de step "- <taille> <allure>", allure omise si libre. */
function stepLine(step: PlanStep, indent = ""): string {
  const size = sizeToken(step) ?? ""
  const pace = paceTarget(step.target_pace_sec, step.pace_tolerance_sec)
  return `${indent}- ${[size, pace].filter(Boolean).join(" ")}`.trimEnd()
}

// Element regroupe : un step simple, ou un bloc repete reconstruit.
export type WorkoutItem =
  | { kind: "step"; step: PlanStep }
  | { kind: "repeat"; count: number; interval: PlanStep; recovery: PlanStep | null }

/**
 * Regroupe les steps aplatis par repeat_group (inverse de expand.ts) : un groupe
 * de N repetitions vaut N steps 'interval' + (N-1) steps 'recovery'. Le count est
 * le nombre d'intervalles ; l'allure du bloc est celle du premier intervalle, la
 * recuperation celle du premier step de recuperation du groupe.
 */
export function groupByRepeat(steps: PlanStep[]): WorkoutItem[] {
  const sorted = [...steps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const items: WorkoutItem[] = []
  let i = 0
  while (i < sorted.length) {
    const st = sorted[i]
    if (st.repeat_group != null) {
      const g = st.repeat_group
      const group: PlanStep[] = []
      while (i < sorted.length && sorted[i].repeat_group === g) group.push(sorted[i++])
      const intervals = group.filter((s) => s.step_type === "interval")
      const recovery = group.find((s) => s.step_type === "recovery") ?? null
      items.push({
        kind: "repeat",
        count: intervals.length || 1,
        interval: intervals[0] ?? group[0],
        recovery,
      })
    } else {
      items.push({ kind: "step", step: st })
      i++
    }
  }
  return items
}

/** Description texte complete d'un workout, prete pour le champ description. */
export function buildWorkoutDescription(steps: PlanStep[] | undefined | null): string {
  const items = groupByRepeat(steps ?? [])
  const lines: string[] = []
  for (const it of items) {
    if (it.kind === "repeat") {
      lines.push(`${it.count}x`)
      lines.push(stepLine(it.interval, INDENT))
      if (it.recovery) lines.push(stepLine(it.recovery, INDENT))
    } else {
      lines.push(stepLine(it.step))
    }
  }
  return lines.join("\n")
}
