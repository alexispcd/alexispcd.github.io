import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { buildPlanSystemPrompt, buildRetryPrompt } from "../_shared/training/methodology.ts"
import { validatePlan } from "../_shared/training/validate.ts"
import { persistPlan } from "../_shared/training/persist.ts"
import { expandPlan } from "../_shared/training/expand.ts"
import { computeWeekBounds, dayTs, type WeekBounds } from "../_shared/training/weeks.ts"
import type { GeneratedPlan } from "../_shared/training/types.ts"
import { buildRegenChunkPrompt, formatHistory } from "./prompt.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
const CHUNK_WEEKS = 4
const MAX_TOKENS = 8000
const TASK_TIMEOUT_MS = 120_000

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })
const todayISO = () => new Date().toISOString().split("T")[0]

async function timed<T>(planId: string, phase: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    return await fn()
  } finally {
    console.log(`[regenerate-plan] ${planId} · ${phase} : ${Date.now() - t0} ms`)
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: number | undefined
  const guard = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms) })
  return Promise.race([p, guard]).finally(() => clearTimeout(timer))
}

interface WeekRow { week_number: number; start_date: string | null; block: string | null; focus: string | null }

async function generateAndParse(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>) {
  const text = await anthropicSimple({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
  try {
    return JSON.parse(extractJson(text)) as GeneratedPlan
  } catch (err) {
    throw new Error(`JSON invalide : ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Historique des semaines passées (< currentWeek) formaté pour le prompt. */
async function buildHistoryText(admin: SupabaseClient, planId: string, currentWeek: number): Promise<string> {
  const { data: weeks } = await admin
    .from("training_weeks")
    .select("week_number, block, start_date")
    .eq("plan_id", planId)
    .lt("week_number", currentWeek)
    .order("week_number", { ascending: true })
  const pastWeeks = (weeks ?? []) as Array<{ week_number: number; block: string | null; start_date: string | null }>
  if (!pastWeeks.length) return "  (aucune semaine écoulée)"

  const { data: pastSessions } = await admin
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
    arr.push({ zone: s.zone as string, type: s.type as string, title: s.title as string, status: s.status as string, verdict: analysis?.verdict ?? null })
    byWeek.set(wn, arr)
  }
  return formatHistory(pastWeeks, byWeek)
}

/** Résumé compact des semaines déjà régénérées ce run (continuité inter-chunks). */
async function buildRegeneratedText(admin: SupabaseClient, planId: string, from: number, to: number): Promise<string> {
  if (to <= from) return ""
  const { data } = await admin
    .from("training_weeks")
    .select("week_number, block, target_km, focus, training_sessions(zone, type)")
    .eq("plan_id", planId)
    .gte("week_number", from)
    .lt("week_number", to)
    .order("week_number", { ascending: true })
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((w) => {
      const sess = ((w.training_sessions ?? []) as Array<Record<string, unknown>>).map((s) => `${s.zone}/${s.type}`).join(", ")
      return `  S${w.week_number} [${w.block ?? "?"}] ${w.target_km ?? "?"} km — ${w.focus ?? ""} · ${sess}`
    })
    .join("\n")
}

async function selfInvokeContinue(payload: Record<string, unknown>): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/regenerate-plan`
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(payload),
  })
}

/**
 * Génère/persiste UN chunk des semaines régénérées [currentWeek..lastWeek], puis
 * chaîne le suivant. L'avancement = nb de semaines déjà (re)persistées ≥ currentWeek.
 */
async function runRegenChunk(
  admin: SupabaseClient,
  planId: string,
  userId: string,
  currentWeek: number,
  lastWeek: number,
): Promise<void> {
  const setError = (message: string) =>
    admin.from("training_plans").update({ generation_status: "error", generation_error: message }).eq("id", planId)

  const t0 = Date.now()
  try {
    await withTimeout((async () => {
      const { data: plan } = await admin
        .from("training_plans")
        .select("start_date, race_name, race_date, race_distance_m, race_elevation_m, goal_time_sec, fitness_snapshot, notes")
        .eq("id", planId)
        .single()
      if (!plan) { await setError("Plan introuvable en cours de régénération"); return }

      const todayStr = todayISO()
      const raceDateStr = plan.race_date as string
      // Bornes calendaires du plan entier (mêmes que la génération) → cohérence
      // des semaines lundi→dimanche même après régénération partielle.
      const bounds = computeWeekBounds((plan.start_date as string | null) ?? todayStr, raceDateStr)
      const boundsByWeek = new Map<number, WeekBounds>(bounds.map((b) => [b.week_number, b]))

      const { count } = await admin
        .from("training_weeks")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", planId)
        .gte("week_number", currentWeek)
      const done = count ?? 0

      const chunkStart = currentWeek + done
      const chunkEnd = Math.min(chunkStart + CHUNK_WEEKS - 1, lastWeek)
      if (chunkStart > lastWeek) {
        await admin.from("training_plans").update({ generation_status: "ready" }).eq("id", planId)
        return
      }

      const chunkBounds = bounds.filter((b) => b.week_number >= chunkStart && b.week_number <= chunkEnd)
      const chunkStartDate = chunkBounds[0]?.start ?? todayStr
      const lowerBoundStr = dayTs(chunkStartDate) < dayTs(todayStr) ? chunkStartDate : todayStr

      const historyText = await buildHistoryText(admin, planId, currentWeek)
      const regeneratedText = await buildRegeneratedText(admin, planId, currentWeek, chunkStart)

      const system = buildPlanSystemPrompt()
      const userPrompt = buildRegenChunkPrompt(
        plan as never, currentWeek, lastWeek, chunkStart, chunkEnd, chunkBounds, historyText, regeneratedText, todayStr,
      )

      const finalizeWeeks = (p: GeneratedPlan) => {
        p.weeks = (p.weeks ?? []).filter((w) => w.week_number >= chunkStart && w.week_number <= chunkEnd)
        for (const w of p.weeks) {
          const b = boundsByWeek.get(w.week_number)
          if (b) w.start_date = b.start
        }
      }

      let regen = await timed(planId, `sonnet chunk ${chunkStart}-${chunkEnd} + parse`, () =>
        generateAndParse(system, [{ role: "user", content: userPrompt }]))
      finalizeWeeks(regen)

      let errors = validatePlan(regen, lowerBoundStr, raceDateStr, chunkStart, boundsByWeek)
      if (errors.length) {
        console.warn(`[regenerate-plan] ${planId} chunk ${chunkStart}-${chunkEnd} invalide (essai 1) :`, errors.slice(0, 8))
        regen = await timed(planId, `sonnet chunk ${chunkStart}-${chunkEnd} retry`, () =>
          generateAndParse(system, [
            { role: "user", content: userPrompt },
            { role: "assistant", content: JSON.stringify(regen) },
            { role: "user", content: buildRetryPrompt(errors) },
          ]))
        finalizeWeeks(regen)
        errors = validatePlan(regen, lowerBoundStr, raceDateStr, chunkStart, boundsByWeek)
      }
      if (errors.length) {
        console.error(`[regenerate-plan] ${planId} chunk ${chunkStart}-${chunkEnd} invalide après retry :`, errors.slice(0, 8))
        await setError(`Régénération chunk ${chunkStart}-${chunkEnd} invalide : ${errors.slice(0, 6).join(" | ")}`)
        return
      }

      await timed(planId, `persist chunk ${chunkStart}-${chunkEnd}`, () =>
        persistPlan(admin, planId, userId, expandPlan(regen)))

      if (chunkEnd >= lastWeek) {
        await admin.from("training_plans").update({ generation_status: "ready" }).eq("id", planId)
        console.log(`[regenerate-plan] ${planId} régénéré (semaines ${currentWeek} à ${lastWeek}) — dernier chunk ${chunkStart}-${chunkEnd}`)
      } else {
        console.log(`[regenerate-plan] ${planId} chunk ${chunkStart}-${chunkEnd}/${lastWeek} ok en ${Date.now() - t0} ms → chaînage`)
        await selfInvokeContinue({ continue_regen: { plan_id: planId, current: currentWeek, last: lastWeek } })
      }
    })(), TASK_TIMEOUT_MS, "Régénération trop longue, réessayez")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[regenerate-plan] ${planId} erreur (${Date.now() - t0} ms) :`, message)
    await setError(message)
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json(401, { error: "Missing authorization" })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // ── Auto-invocation interne : chunk suivant ─────────────────────────────────
  if (body?.continue_regen) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    if (authHeader !== `Bearer ${serviceKey}`) return json(401, { error: "Unauthorized (continuation)" })
    const c = body.continue_regen as { plan_id: string; current: number; last: number }
    const { data: row } = await supabaseAdmin
      .from("training_plans")
      .select("user_id, generation_status")
      .eq("id", c.plan_id)
      .single()
    if (!row) return json(404, { error: "Plan introuvable" })
    if (row.generation_status !== "generating") return json(200, { ok: true, skipped: true })
    EdgeRuntime.waitUntil(runRegenChunk(supabaseAdmin, c.plan_id, row.user_id as string, c.current, c.last))
    return json(200, { ok: true })
  }

  // ── Requête utilisateur ─────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })

  const planId = body.plan_id as string
  if (!planId) return json(400, { error: "plan_id requis" })

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("id, status, generation_status, race_date")
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

  const { data: weeksData, error: weeksErr } = await supabaseAdmin
    .from("training_weeks")
    .select("week_number, start_date, block, focus")
    .eq("plan_id", planId)
    .order("week_number", { ascending: true })
  if (weeksErr) return json(500, { error: "Lecture des semaines impossible", detail: weeksErr.message })
  const weeks = (weeksData ?? []) as WeekRow[]
  if (weeks.length === 0) return json(400, { error: "Le plan n'a aucune semaine à régénérer" })

  // Semaine courante : dernière dont le start_date est <= aujourd'hui.
  const todayNum = dayTs(todayStr)
  let currentWeek = weeks[0].week_number
  for (const w of weeks) {
    if (w.start_date && dayTs(w.start_date) <= todayNum) currentWeek = w.week_number
  }
  const lastWeek = weeks[weeks.length - 1].week_number
  if (currentWeek > lastWeek) return json(400, { error: "Aucune semaine à venir à régénérer" })

  // Passer en génération, supprimer les semaines à régénérer (cascade), puis chaîner.
  const { error: statusErr } = await supabaseAdmin
    .from("training_plans")
    .update({ generation_status: "generating", generation_error: null })
    .eq("id", planId)
  if (statusErr) return json(500, { error: "Mise à jour du statut impossible", detail: statusErr.message })

  const { error: delErr } = await supabaseAdmin
    .from("training_weeks")
    .delete()
    .eq("plan_id", planId)
    .gte("week_number", currentWeek)
  if (delErr) return json(500, { error: "Suppression des semaines impossible", detail: delErr.message })

  EdgeRuntime.waitUntil(runRegenChunk(supabaseAdmin, planId, user.id, currentWeek, lastWeek))
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
