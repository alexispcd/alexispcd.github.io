// Déplie le format COMPACT (sortie modèle) en steps aplatis conformes au schéma
// session_steps : order_index séquentiel, repeat_group/repeat_index renseignés,
// pas de recovery après la dernière répétition (même convention que le frontend).

import type {
  CompactStep, CompactRepeat, PlanStep,
  GeneratedPlan, ExpandedPlan, ExpandedSession,
} from "./types.ts"

/** Un élément compact est un bloc de répétitions s'il porte un champ `repeat`. */
export const isRepeatBlock = (s: CompactStep): s is CompactRepeat =>
  typeof (s as CompactRepeat).repeat === "number"

/** Déplie une liste de steps compacts en steps aplatis. */
export function expandSteps(compact: CompactStep[] | undefined | null): PlanStep[] {
  if (!Array.isArray(compact)) return []
  const out: PlanStep[] = []
  let order = 0
  let repeatGroup = 0

  for (const el of compact) {
    if (isRepeatBlock(el)) {
      repeatGroup += 1
      const n = el.repeat
      for (let i = 1; i <= n; i++) {
        out.push({
          order_index: order++,
          step_type: "interval",
          repeat_group: repeatGroup,
          repeat_index: i,
          target_pace_sec: el.interval?.target_pace_sec ?? null,
          pace_tolerance_sec: el.interval?.pace_tolerance_sec ?? 5,
          distance_m: el.interval?.distance_m ?? null,
          duration_sec: el.interval?.duration_sec ?? null,
        })
        // Pas de récupération après la dernière répétition.
        if (el.recovery && i < n) {
          out.push({
            order_index: order++,
            step_type: "recovery",
            repeat_group: repeatGroup,
            repeat_index: i,
            target_pace_sec: el.recovery.target_pace_sec ?? null,
            pace_tolerance_sec: el.recovery.pace_tolerance_sec ?? null,
            distance_m: el.recovery.distance_m ?? null,
            duration_sec: el.recovery.duration_sec ?? null,
          })
        }
      }
    } else {
      out.push({
        order_index: order++,
        step_type: el.step_type,
        repeat_group: null,
        repeat_index: null,
        target_pace_sec: el.target_pace_sec ?? null,
        pace_tolerance_sec: el.pace_tolerance_sec ?? (el.step_type === "recovery" ? null : 5),
        distance_m: el.distance_m ?? null,
        duration_sec: el.duration_sec ?? null,
      })
    }
  }
  return out
}

/**
 * Repli inverse : steps aplatis (BDD) → format compact. Utilisé pour présenter
 * au modèle une séance existante dans le MÊME format que sa sortie attendue
 * (adaptation), afin d'éviter qu'il recopie des répétitions aplaties.
 */
export function foldSteps(flat: PlanStep[] | undefined | null): CompactStep[] {
  if (!Array.isArray(flat)) return []
  const sorted = [...flat].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const out: CompactStep[] = []
  let i = 0
  while (i < sorted.length) {
    const st = sorted[i]
    if (st.step_type === "interval" && st.repeat_group != null) {
      const g = st.repeat_group
      const group: PlanStep[] = []
      while (i < sorted.length && sorted[i].repeat_group === g) group.push(sorted[i++])
      const intervals = group.filter((s) => s.step_type === "interval")
      const recovery = group.find((s) => s.step_type === "recovery")
      const iv = intervals[0] ?? group[0]
      out.push({
        repeat: intervals.length,
        interval: {
          target_pace_sec: iv.target_pace_sec ?? null,
          pace_tolerance_sec: iv.pace_tolerance_sec ?? null,
          distance_m: iv.distance_m ?? null,
          duration_sec: iv.duration_sec ?? null,
        },
        recovery: recovery
          ? {
            target_pace_sec: recovery.target_pace_sec ?? null,
            distance_m: recovery.distance_m ?? null,
            duration_sec: recovery.duration_sec ?? null,
          }
          : null,
      })
    } else {
      out.push({
        step_type: st.step_type,
        target_pace_sec: st.target_pace_sec ?? null,
        pace_tolerance_sec: st.pace_tolerance_sec ?? null,
        distance_m: st.distance_m ?? null,
        duration_sec: st.duration_sec ?? null,
      })
      i++
    }
  }
  return out
}

/** Déplie tout un plan : renfo inchangé, séances de course → steps aplatis. */
export function expandPlan(plan: GeneratedPlan): ExpandedPlan {
  return {
    ...plan,
    weeks: plan.weeks.map((w) => ({
      ...w,
      sessions: w.sessions.map((s): ExpandedSession => ({
        ...s,
        steps: Array.isArray(s.steps) ? expandSteps(s.steps) : undefined,
      })),
    })),
  }
}
