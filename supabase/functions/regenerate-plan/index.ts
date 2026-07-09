import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { buildPlanSystemPrompt, buildRetryPrompt } from "../_shared/training/methodology.ts"
import { dayTs, validatePlan } from "../_shared/training/validate.ts"
import { persistPlan } from "../_shared/training/persist.ts"
import { expandPlan } from "../_shared/training/expand.ts"
import type { GeneratedPlan } from "../_shared/training/types.ts"
import { buildRegenUserPrompt, formatHistory, type RegenWeekMeta } from "./prompt.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
// Régénération = seulement les semaines restantes → 10000 suffit largement
// (format compact, cf. generate-plan).
const MAX_TOKENS = 10000
const TASK_TIMEOUT_MS = 5 * 60_000

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })
const todayISO = () => new Date().toISOString().split("T")[0]

/** Chronomètre une phase et logue sa durée en ms. */
async function timed<T>(planId: string, phase: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    return await fn()
  } finally {
    console.log(`[regenerate-plan] ${planId} · ${phase} : ${Date.now() - t0} ms`)
  }
}

/** Rejette après `ms` avec un message explicite (garde-fou anti-blocage). */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: number | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([p, guard]).finally(() => clearTimeout(timer))
}

interface WeekRow {
  week_number: number
  start_date: string | null
  block: string | null
  focus: string | null
}

async function generateAndParse(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const text = await anthropicSimple({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
  try {
    return JSON.parse(extractJson(text)) as GeneratedPlan
  } catch (err) {
    throw new Error(`JSON invalide : ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function regenerateInBackground(
  supabaseAdmin: SupabaseClient,
  planId: string,
  userId: string,
  plan: Record<string, unknown>,
  currentWeek: number,
  lastWeek: number,
  regenWeeks: RegenWeekMeta[],
  historyText: string,
): Promise<void> {
  const setError = (message: string) =>
    supabaseAdmin.from("training_plans")
      .update({ generation_status: "error", generation_error: message })
      .eq("id", planId)

  const t0 = Date.now()
  try {
    await withTimeout((async () => {
      const todayStr = todayISO()
      const raceDateStr = plan.race_date as string

      // Borne basse de validation : la semaine courante a pu démarrer avant aujourd'hui.
      const firstStart = regenWeeks[0]?.start_date
      const lowerBoundStr = firstStart && dayTs(firstStart) < dayTs(todayStr) ? firstStart : todayStr

      const system = buildPlanSystemPrompt()
      const userPrompt = buildRegenUserPrompt(
        plan as never,
        currentWeek,
        lastWeek,
        regenWeeks,
        historyText,
        todayStr,
      )

      let regen = await timed(planId, "sonnet initial + parse", () =>
        generateAndParse(system, [{ role: "user", content: userPrompt }]))
      let errors = validatePlan(regen, lowerBoundStr, raceDateStr, currentWeek)

      if (errors.length) {
        console.warn(`[regenerate-plan] plan ${planId} invalide (essai 1) :`, errors.slice(0, 10))
        regen = await timed(planId, "sonnet retry + parse", () =>
          generateAndParse(system, [
            { role: "user", content: userPrompt },
            { role: "assistant", content: JSON.stringify(regen) },
            { role: "user", content: buildRetryPrompt(errors) },
          ]))
        errors = validatePlan(regen, lowerBoundStr, raceDateStr, currentWeek)
      }

      if (errors.length) {
        console.error(`[regenerate-plan] plan ${planId} invalide après retry :`, errors.slice(0, 10))
        await setError(`Régénération invalide après retry : ${errors.slice(0, 8).join(" | ")}`)
        return
      }

      // Delete AVANT insert (index unique plan_id, week_number). Cascade sur séances + steps.
      const { error: delErr } = await supabaseAdmin
        .from("training_weeks")
        .delete()
        .eq("plan_id", planId)
        .gte("week_number", currentWeek)
      if (delErr) throw new Error(`Suppression semaines régénérées : ${delErr.message}`)

      // Dépliage du format compact avant persistance.
      const expanded = expandPlan(regen)
      await timed(planId, "persistance", () => persistPlan(supabaseAdmin, planId, userId, expanded))

      await supabaseAdmin.from("training_plans")
        .update({ generation_status: "ready" })
        .eq("id", planId)

      console.log(`[regenerate-plan] plan ${planId} régénéré (semaines ${currentWeek}–${lastWeek}) en ${Date.now() - t0} ms`)
    })(), TASK_TIMEOUT_MS, "Régénération trop longue, réessayez")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[regenerate-plan] plan ${planId} erreur (${Date.now() - t0} ms) :`, message)
    await setError(message)
  }
}

async function handleRequest(req: Request): Promise<Response> {
  // 1. Auth
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json(401, { error: "Missing authorization" })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 2. Corps
  let planId: string
  try {
    const body = await req.json()
    planId = body.plan_id
    if (!planId) throw new Error("plan_id requis")
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("id, status, generation_status, race_name, race_date, race_distance_m, race_elevation_m, goal_time_sec, fitness_snapshot, notes")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  if (planErr || !plan) return json(404, { error: "Plan introuvable" })
  if (plan.status !== "active") return json(409, { error: "Le plan n'est pas actif" })
  if (plan.generation_status === "generating") return json(409, { error: "Génération déjà en cours" })

  const todayStr = todayISO()
  if (plan.race_date && dayTs(plan.race_date) < dayTs(todayStr)) {
    return json(400, { error: "La course est déjà passée" })
  }

  // 4. Semaines du plan
  const { data: weeksData, error: weeksErr } = await supabaseAdmin
    .from("training_weeks")
    .select("week_number, start_date, block, focus")
    .eq("plan_id", planId)
    .order("week_number", { ascending: true })
  if (weeksErr) return json(500, { error: "Lecture des semaines impossible", detail: weeksErr.message })
  const weeks = (weeksData ?? []) as WeekRow[]
  if (weeks.length === 0) return json(400, { error: "Le plan n'a aucune semaine à régénérer" })

  // 5. Semaine courante : dernière semaine dont le start_date est <= aujourd'hui
  const todayNum = dayTs(todayStr)
  let currentWeek = weeks[0].week_number
  for (const w of weeks) {
    if (w.start_date && dayTs(w.start_date) <= todayNum) currentWeek = w.week_number
  }
  const lastWeek = weeks[weeks.length - 1].week_number

  const regenWeeks: RegenWeekMeta[] = weeks
    .filter((w) => w.week_number >= currentWeek)
    .map((w) => ({ week_number: w.week_number, start_date: w.start_date }))
  if (regenWeeks.length === 0) return json(400, { error: "Aucune semaine à venir à régénérer" })

  // 6. Historique réel des semaines passées (contexte IA)
  const pastWeeks = weeks.filter((w) => w.week_number < currentWeek)
  let historyText = "  (aucune semaine écoulée)"
  if (pastWeeks.length) {
    const { data: pastSessions } = await supabaseAdmin
      .from("training_sessions")
      .select("zone, type, title, status, analysis, training_weeks!inner(week_number)")
      .eq("plan_id", planId)
      .lt("training_weeks.week_number", currentWeek)
      .order("scheduled_date", { ascending: true })

    const byWeek = new Map<number, Array<{ zone: string; type: string; title: string; status: string; verdict: string | null }>>()
    for (const s of (pastSessions ?? []) as Array<Record<string, unknown>>) {
      const wn = (s.training_weeks as { week_number: number }).week_number
      const analysis = s.analysis as { verdict?: string } | null
      const arr = byWeek.get(wn) ?? []
      arr.push({
        zone: s.zone as string,
        type: s.type as string,
        title: s.title as string,
        status: s.status as string,
        verdict: analysis?.verdict ?? null,
      })
      byWeek.set(wn, arr)
    }
    historyText = formatHistory(pastWeeks, byWeek)
  }

  // 7. Passer en génération et répondre immédiatement
  const { error: statusErr } = await supabaseAdmin
    .from("training_plans")
    .update({ generation_status: "generating", generation_error: null })
    .eq("id", planId)
  if (statusErr) return json(500, { error: "Mise à jour du statut impossible", detail: statusErr.message })

  EdgeRuntime.waitUntil(
    regenerateInBackground(
      supabaseAdmin,
      planId,
      user.id,
      plan as Record<string, unknown>,
      currentWeek,
      lastWeek,
      regenWeeks,
      historyText,
    ),
  )

  return json(200, { plan_id: planId })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[regenerate-plan] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})
