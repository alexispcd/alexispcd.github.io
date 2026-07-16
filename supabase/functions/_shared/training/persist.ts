import type { SupabaseClient } from "@supabase/supabase-js"
import type { ExpandedPlan, ExpandedSession, PlanStep } from "./types.ts"
import { isStrengthSession } from "./validate.ts"
import { finalizeStrengthContent } from "./strength.ts"

/**
 * Insère semaines → séances → steps pour un plan existant.
 * `weeks` peut être le plan complet (génération) ou un sous-ensemble
 * (régénération partielle) ; l'appelant garantit que les week_number
 * insérés n'entrent pas en conflit avec l'index unique (plan_id, week_number)
 * — donc supprime les semaines régénérées AVANT d'appeler cette fonction.
 *
 * Aucun insert partiel : en cas d'échec, purge les semaines concernées
 * (cascade sur séances + steps) puis relance l'erreur.
 */
export async function persistPlan(
  supabaseAdmin: SupabaseClient,
  planId: string,
  userId: string,
  plan: ExpandedPlan,
): Promise<void> {
  const weekNumbers = plan.weeks.map((w) => w.week_number)
  try {
    // 1. Semaines
    const weekRows = plan.weeks.map((w) => ({
      user_id: userId,
      plan_id: planId,
      week_number: w.week_number,
      block: w.block,
      focus: w.focus ?? null,
      target_km: w.target_km ?? null,
      start_date: w.start_date ?? null,
    }))
    const { data: insertedWeeks, error: weeksErr } = await supabaseAdmin
      .from("training_weeks")
      .insert(weekRows)
      .select("id, week_number")
    if (weeksErr) throw new Error(`Insertion semaines : ${weeksErr.message}`)

    const weekIdByNumber = new Map<number, string>(
      (insertedWeeks as Array<{ id: string; week_number: number }>).map((w) => [w.week_number, w.id]),
    )

    // 2. Séances — ordre préservé pour recoller les steps aux ids retournés.
    const sessionsFlat: ExpandedSession[] = []
    const sessionRows: Record<string, unknown>[] = []
    for (const w of plan.weeks) {
      const weekId = weekIdByNumber.get(w.week_number)
      for (const s of w.sessions) {
        sessionsFlat.push(s)
        sessionRows.push({
          user_id: userId,
          plan_id: planId,
          week_id: weekId,
          scheduled_date: s.scheduled_date,
          zone: s.zone,
          type: s.type,
          title: s.title,
          rationale: s.rationale ?? null,
          // Renfo : enrichissement catalogue + base figée + trim à 40 min (défaut).
          strength_content: isStrengthSession(s)
            ? finalizeStrengthContent(s.strength_content as never)
            : null,
          status: "planned",
        })
      }
    }
    const { data: insertedSessions, error: sessErr } = await supabaseAdmin
      .from("training_sessions")
      .insert(sessionRows)
      .select("id")
    if (sessErr) throw new Error(`Insertion séances : ${sessErr.message}`)

    // 3. Steps
    const stepRows: Record<string, unknown>[] = [];
    (insertedSessions as Array<{ id: string }>).forEach((row, i) => {
      const s = sessionsFlat[i]
      if (isStrengthSession(s) || !Array.isArray(s.steps)) return
      for (const st of s.steps) {
        stepRows.push({
          user_id: userId,
          session_id: row.id,
          order_index: st.order_index,
          step_type: st.step_type,
          repeat_group: st.repeat_group ?? null,
          repeat_index: st.repeat_index ?? null,
          target_pace_sec: st.target_pace_sec ?? null,
          pace_tolerance_sec: st.pace_tolerance_sec ?? 5,
          distance_m: st.distance_m ?? null,
          duration_sec: st.duration_sec ?? null,
        })
      }
    })
    if (stepRows.length) {
      const { error: stepsErr } = await supabaseAdmin.from("session_steps").insert(stepRows)
      if (stepsErr) throw new Error(`Insertion steps : ${stepsErr.message}`)
    }
  } catch (err) {
    // Rollback : supprimer les semaines concernées purge séances + steps par cascade.
    await supabaseAdmin.from("training_weeks")
      .delete()
      .eq("plan_id", planId)
      .in("week_number", weekNumbers)
    throw err
  }
}

/**
 * Construit les lignes session_steps pour une séance donnée (utilisé par
 * l'adaptation, où l'on remplace les steps d'une séance existante).
 */
export function buildStepRows(
  sessionId: string,
  userId: string,
  steps: PlanStep[] | undefined | null,
): Record<string, unknown>[] {
  if (!Array.isArray(steps)) return []
  return steps.map((st) => ({
    user_id: userId,
    session_id: sessionId,
    order_index: st.order_index,
    step_type: st.step_type,
    repeat_group: st.repeat_group ?? null,
    repeat_index: st.repeat_index ?? null,
    target_pace_sec: st.target_pace_sec ?? null,
    pace_tolerance_sec: st.pace_tolerance_sec ?? 5,
    distance_m: st.distance_m ?? null,
    duration_sec: st.duration_sec ?? null,
  }))
}
