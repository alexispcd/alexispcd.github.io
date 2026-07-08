import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { isStrengthSession, validateSessionContent } from "../_shared/training/validate.ts"
import { buildStepRows } from "../_shared/training/persist.ts"
import type { PlanSession, PlanStep } from "../_shared/training/types.ts"
import { buildAdaptSystemPrompt, buildAdaptUserPrompt, type SessionContent } from "./prompt.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
const WINDOW_DAYS = 10
const STEP_COLS = "order_index, step_type, repeat_group, repeat_index, target_pace_sec, pace_tolerance_sec, distance_m, duration_sec"
const SESSION_COLS = `id, scheduled_date, zone, type, title, rationale, notes, strength_content, session_steps(${STEP_COLS})`

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

interface AdaptedOut {
  id: string
  title?: string
  rationale?: string
  steps?: PlanStep[]
  strength_content?: unknown
}

/** Normalise une ligne séance (+ steps imbriqués) en SessionContent (steps triés). */
function toSessionContent(row: Record<string, unknown>): SessionContent {
  const steps = ((row.session_steps ?? []) as PlanStep[])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  return {
    id: row.id as string,
    scheduled_date: row.scheduled_date as string,
    zone: row.zone as string,
    type: row.type as string,
    title: row.title as string,
    rationale: (row.rationale as string) ?? null,
    notes: (row.notes as string) ?? null,
    strength_content: row.strength_content ?? null,
    steps,
  }
}

function shiftDate(dateStr: string, days: number): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return dateStr
  const ts = Date.UTC(+m[1], +m[2] - 1, +m[3]) + days * 86_400_000
  return new Date(ts).toISOString().slice(0, 10)
}

async function callModel(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<AdaptedOut[]> {
  const text = await anthropicSimple({ model: MODEL, max_tokens: 8000, system, messages })
  const parsed = JSON.parse(extractJson(text)) as { adapted?: AdaptedOut[] }
  return parsed.adapted ?? []
}

/** Valide les séances adaptées contre le contenu existant (zone/type figés). */
function validateAdapted(adapted: AdaptedOut[], byId: Map<string, SessionContent>): string[] {
  const errors: string[] = []
  for (const a of adapted) {
    const cur = byId.get(a.id)
    if (!cur) {
      errors.push(`séance ${a.id} : hors fenêtre`)
      continue
    }
    const pseudo: PlanSession = {
      scheduled_date: cur.scheduled_date,
      zone: cur.zone as PlanSession["zone"],
      type: cur.type as PlanSession["type"],
      title: a.title ?? cur.title,
      steps: a.steps,
      strength_content: a.strength_content,
    }
    validateSessionContent(pseudo, `séance ${a.id}`, errors)
  }
  return errors
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
  let sessionId: string
  try {
    const body = await req.json()
    sessionId = body.session_id
    if (!sessionId) throw new Error("session_id requis")
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Séance sautée (+ steps) et plan
  const { data: skippedRow, error: skErr } = await supabaseAdmin
    .from("training_sessions")
    .select(`plan_id, ${SESSION_COLS}`)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (skErr || !skippedRow) return json(404, { error: "Séance introuvable" })

  const skipped = toSessionContent(skippedRow)
  const planId = skippedRow.plan_id as string

  // Séance facile / renfo sautée → aucune compensation (règle déterministe).
  if (skipped.type === "facile" || skipped.type === "renfo") {
    return json(200, { sessions: [] })
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("race_name, race_date, fitness_snapshot")
    .eq("id", planId)
    .single()
  if (planErr || !plan) return json(404, { error: "Plan introuvable" })

  // 4. Fenêtre : séances suivantes 'planned' dans [date sautée, +10 jours]
  const windowEnd = shiftDate(skipped.scheduled_date, WINDOW_DAYS)
  const { data: windowRows, error: winErr } = await supabaseAdmin
    .from("training_sessions")
    .select(SESSION_COLS)
    .eq("plan_id", planId)
    .eq("status", "planned")
    .gt("scheduled_date", skipped.scheduled_date)
    .lte("scheduled_date", windowEnd)
    .order("scheduled_date", { ascending: true })
  if (winErr) return json(500, { error: "Lecture de la fenêtre impossible", detail: winErr.message })

  const windowSessions = (windowRows ?? []).map((r) => toSessionContent(r as Record<string, unknown>))
  if (windowSessions.length === 0) return json(200, { sessions: [] })

  const byId = new Map(windowSessions.map((s) => [s.id, s]))

  // 5. Appel Sonnet (synchrone, mode simple)
  const system = buildAdaptSystemPrompt()
  const userPrompt = buildAdaptUserPrompt(plan as never, skipped, windowSessions)

  let adapted: AdaptedOut[]
  try {
    adapted = await callModel(system, [{ role: "user", content: userPrompt }])
  } catch (err) {
    return json(502, { error: "Erreur IA d'adaptation", detail: err instanceof Error ? err.message : String(err) })
  }

  // 6. Validation stricte (+ 1 retry ciblé sur les séances hors fenêtre exclues)
  adapted = adapted.filter((a) => byId.has(a.id))
  if (adapted.length === 0) return json(200, { sessions: [] })

  let errors = validateAdapted(adapted, byId)
  if (errors.length) {
    try {
      adapted = await callModel(system, [
        { role: "user", content: userPrompt },
        { role: "assistant", content: JSON.stringify({ adapted }) },
        {
          role: "user",
          content: "Le JSON est invalide. Corrige STRICTEMENT selon les erreurs suivantes et renvoie tout :\n" +
            errors.slice(0, 20).map((e) => `- ${e}`).join("\n"),
        },
      ])
      adapted = adapted.filter((a) => byId.has(a.id))
      errors = validateAdapted(adapted, byId)
    } catch (err) {
      return json(502, { error: "Erreur IA d'adaptation (retry)", detail: err instanceof Error ? err.message : String(err) })
    }
  }
  if (errors.length) {
    return json(422, { error: "Adaptation invalide", details: errors.slice(0, 10) })
  }
  if (adapted.length === 0) return json(200, { sessions: [] })

  // 7. Application (snapshot previous_version, update, remplacement des steps)
  const now = new Date().toISOString()
  const changedIds: string[] = []
  for (const a of adapted) {
    const cur = byId.get(a.id)!
    const isRenfo = isStrengthSession({ type: cur.type as PlanSession["type"], zone: cur.zone as PlanSession["zone"] })

    const previousVersion = {
      title: cur.title,
      rationale: cur.rationale,
      notes: cur.notes,
      steps: cur.steps,
      strength_content: cur.strength_content,
    }

    const { error: updErr } = await supabaseAdmin
      .from("training_sessions")
      .update({
        title: a.title ?? cur.title,
        rationale: a.rationale ?? cur.rationale,
        strength_content: isRenfo ? (a.strength_content ?? cur.strength_content) : cur.strength_content,
        previous_version: previousVersion,
        status: "adapted",
        adapted_at: now,
        adapted_by_session_id: sessionId,
      })
      .eq("id", a.id)
      .eq("user_id", user.id)
    if (updErr) {
      console.error("[adapt-sessions] update échec", a.id, updErr.message)
      continue
    }

    // Remplacement des steps (séances de course uniquement)
    if (!isRenfo && Array.isArray(a.steps)) {
      await supabaseAdmin.from("session_steps").delete().eq("session_id", a.id)
      const rows = buildStepRows(a.id, user.id, a.steps)
      if (rows.length) {
        const { error: stepsErr } = await supabaseAdmin.from("session_steps").insert(rows)
        if (stepsErr) console.error("[adapt-sessions] insert steps échec", a.id, stepsErr.message)
      }
    }
    changedIds.push(a.id)
  }

  // 8. Renvoyer les séances modifiées complètes (avec steps)
  const { data: updatedRows } = await supabaseAdmin
    .from("training_sessions")
    .select(`${SESSION_COLS}, status, adapted_at, adapted_by_session_id, previous_version`)
    .in("id", changedIds.length ? changedIds : ["00000000-0000-0000-0000-000000000000"])
    .order("scheduled_date", { ascending: true })

  const sessions = (updatedRows ?? []).map((r) => {
    const rec = r as Record<string, unknown>
    const steps = ((rec.session_steps ?? []) as PlanStep[]).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    return { ...rec, session_steps: steps }
  })

  return json(200, { sessions })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[adapt-sessions] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})
