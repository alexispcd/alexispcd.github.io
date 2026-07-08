import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { buildRetryPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt.ts"
import { validatePlan } from "../_shared/training/validate.ts"
import { persistPlan } from "../_shared/training/persist.ts"
import type { GeneratedPlan, GenerateInput } from "./types.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 32000

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: CORS })

function todayISO(): string {
  return new Date().toISOString().split("T")[0]
}

/** Nombre de semaines entre aujourd'hui et la course (au moins 1). */
function weeksUntil(todayStr: string, raceDateStr: string): number {
  const ms = new Date(raceDateStr).getTime() - new Date(todayStr).getTime()
  return Math.max(1, Math.round(ms / (7 * 24 * 3600 * 1000)))
}

/** Valide le corps de la requête. Retourne un message d'erreur ou null. */
function validateInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return "Corps JSON requis"
  const i = input as Partial<GenerateInput>

  const r = i.race
  if (!r || typeof r !== "object") return "race requis"
  if (!r.name) return "race.name requis"
  if (!r.date || Number.isNaN(new Date(r.date).getTime())) return "race.date invalide"
  if (typeof r.distance_m !== "number" || r.distance_m <= 0) return "race.distance_m invalide"

  const f = i.fitness_snapshot
  if (!f || typeof f !== "object") return "fitness_snapshot requis"
  if (f.source !== "coros" && f.source !== "manual") return "fitness_snapshot.source invalide"
  if (typeof f.vma_kmh !== "number" || f.vma_kmh <= 0) return "fitness_snapshot.vma_kmh invalide"

  const today = new Date(todayISO()).getTime()
  if (new Date(r.date).getTime() < today) return "race.date est dans le passé"
  return null
}

async function generateAndParse(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<GeneratedPlan> {
  const text = await anthropicSimple({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
  try {
    return JSON.parse(extractJson(text)) as GeneratedPlan
  } catch (err) {
    throw new Error(`JSON invalide : ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function generateInBackground(
  supabaseAdmin: SupabaseClient,
  planId: string,
  userId: string,
  input: GenerateInput,
): Promise<void> {
  const setError = (message: string) =>
    supabaseAdmin.from("training_plans")
      .update({ generation_status: "error", generation_error: message })
      .eq("id", planId)

  try {
    const todayStr = todayISO()
    const raceDateStr = input.race.date
    const weeks = weeksUntil(todayStr, raceDateStr)

    const system = buildSystemPrompt()
    const userPrompt = buildUserPrompt(input, todayStr, weeks)

    // 1er essai
    let plan = await generateAndParse(system, [{ role: "user", content: userPrompt }])
    let errors = validatePlan(plan, todayStr, raceDateStr)

    // 1 retry avec la liste précise des erreurs
    if (errors.length) {
      console.warn(`[generate-plan] plan ${planId} invalide (essai 1) :`, errors.slice(0, 10))
      plan = await generateAndParse(system, [
        { role: "user", content: userPrompt },
        { role: "assistant", content: JSON.stringify(plan) },
        { role: "user", content: buildRetryPrompt(errors) },
      ])
      errors = validatePlan(plan, todayStr, raceDateStr)
    }

    if (errors.length) {
      console.error(`[generate-plan] plan ${planId} invalide après retry :`, errors.slice(0, 10))
      await setError(`Plan invalide après retry : ${errors.slice(0, 8).join(" | ")}`)
      return
    }

    // Insert atomique (rollback interne en cas d'échec partiel)
    await persistPlan(supabaseAdmin, planId, userId, plan)

    await supabaseAdmin.from("training_plans")
      .update({ summary: plan.summary ?? null, generation_status: "ready" })
      .eq("id", planId)

    console.log(`[generate-plan] plan ${planId} prêt (${plan.weeks.length} semaines)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[generate-plan] plan ${planId} erreur :`, message)
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
  let input: GenerateInput
  try {
    input = await req.json()
  } catch {
    return json(400, { error: "Corps JSON invalide" })
  }
  const inputError = validateInput(input)
  if (inputError) return json(400, { error: inputError })

  // 3. Refuser si un plan actif existe déjà
  const { data: active } = await supabaseAdmin
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (active) return json(409, { error: "Un plan actif existe déjà", plan_id: active.id })

  // 4. Créer le plan (generating) et répondre immédiatement
  const planRow = {
    user_id: user.id,
    status: "active",
    generation_status: "generating",
    race_name: input.race.name,
    race_date: input.race.date,
    race_distance_m: input.race.distance_m,
    race_elevation_m: input.race.elevation_m ?? null,
    goal_time_sec: input.goal_time_sec ?? null,
    fitness_snapshot: input.fitness_snapshot,
    previous_races: input.previous_races ?? null,
    notes: input.notes ?? null,
  }
  const { data: newPlan, error: insertError } = await supabaseAdmin
    .from("training_plans")
    .insert(planRow)
    .select("id")
    .single()

  if (insertError || !newPlan) {
    // 23505 = violation de l'index unique partiel (plan actif concurrent) → filet de sécurité
    if (insertError?.code === "23505") {
      return json(409, { error: "Un plan actif existe déjà" })
    }
    console.error("[generate-plan] insert plan error:", JSON.stringify(insertError))
    return json(500, { error: "Impossible de créer le plan", detail: insertError?.message })
  }

  EdgeRuntime.waitUntil(generateInBackground(supabaseAdmin, newPlan.id, user.id, input))
  return json(200, { plan_id: newPlan.id })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[generate-plan] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})
