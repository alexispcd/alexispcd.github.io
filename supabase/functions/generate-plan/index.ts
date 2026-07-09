import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { extractJson } from "../_shared/extract-json.ts"
import {
  buildSystemPrompt, buildRetryPrompt, buildChunkUserPrompt,
  formatPriorWeeks, type PriorWeek,
} from "./prompt.ts"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { validatePlan } from "../_shared/training/validate.ts"
import { persistPlan } from "../_shared/training/persist.ts"
import { expandPlan } from "../_shared/training/expand.ts"
import type { GeneratedPlan, GenerateInput } from "./types.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
// Génération par CHUNK de semaines, une invocation = un appel Sonnet court, bien
// sous la limite wall-clock (~150s free tier). Le chunk suivant est déclenché par
// une auto-invocation (chaînage), l'avancement étant déduit des semaines persistées.
const CHUNK_WEEKS = 4
const MAX_TOKENS = 8000
// Filet applicatif : chaque invocation étant courte, ce timeout (< kill runtime)
// convertit un chunk qui traîne en erreur explicite au lieu d'une mort silencieuse.
const TASK_TIMEOUT_MS = 120_000

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })
const todayISO = () => new Date().toISOString().split("T")[0]

/** yyyy-MM-dd de la semaine N (semaine 1 = today). */
function startDateForWeek(todayStr: string, weekNumber: number): string {
  const m = todayStr.match(/^(\d{4})-(\d{2})-(\d{2})/)!
  const ts = Date.UTC(+m[1], +m[2] - 1, +m[3]) + (weekNumber - 1) * 7 * 86_400_000
  return new Date(ts).toISOString().slice(0, 10)
}

/** Nombre de semaines entre aujourd'hui et la course (au moins 1). */
function weeksUntil(todayStr: string, raceDateStr: string): number {
  const ms = new Date(raceDateStr).getTime() - new Date(todayStr).getTime()
  return Math.max(1, Math.round(ms / (7 * 24 * 3600 * 1000)))
}

/** Chronomètre une phase et logue sa durée en ms. */
async function timed<T>(planId: string, phase: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now()
  try {
    return await fn()
  } finally {
    console.log(`[generate-plan] ${planId} · ${phase} : ${Date.now() - t0} ms`)
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

/** Valide le corps de la requête utilisateur. Retourne un message d'erreur ou null. */
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

/** Reconstruit un GenerateInput depuis la ligne training_plans (auto-invocation). */
function inputFromPlanRow(row: Record<string, unknown>): GenerateInput {
  return {
    race: {
      name: row.race_name as string,
      date: row.race_date as string,
      distance_m: row.race_distance_m as number,
      elevation_m: (row.race_elevation_m as number | null) ?? undefined,
    },
    goal_time_sec: (row.goal_time_sec as number | null) ?? undefined,
    fitness_snapshot: row.fitness_snapshot as GenerateInput["fitness_snapshot"],
    previous_races: row.previous_races ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
  }
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

/** Semaines déjà persistées (contexte de continuité pour le chunk suivant). */
async function fetchPriorWeeks(admin: SupabaseClient, planId: string): Promise<PriorWeek[]> {
  const { data } = await admin
    .from("training_weeks")
    .select("week_number, block, focus, target_km, training_sessions(zone, type, title)")
    .eq("plan_id", planId)
    .order("week_number", { ascending: true })
  return ((data ?? []) as Array<Record<string, unknown>>).map((w) => ({
    week_number: w.week_number as number,
    block: (w.block as string | null) ?? null,
    focus: (w.focus as string | null) ?? null,
    target_km: (w.target_km as number | null) ?? null,
    sessions: ((w.training_sessions ?? []) as Array<Record<string, unknown>>).map((s) => ({
      zone: s.zone as string,
      type: s.type as string,
      title: s.title as string,
    })),
  }))
}

/** Déclenche l'invocation du chunk suivant (auth service_role interne). */
async function selfInvokeContinue(planId: string): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-plan`
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ continue_plan_id: planId }),
  })
}

/**
 * Génère et persiste UN chunk de semaines, puis chaîne le suivant (ou clôt le plan).
 * L'avancement est déduit du nombre de semaines déjà persistées → idempotent et
 * repartable : chaque invocation reprend là où la précédente s'est arrêtée.
 */
async function runChunkAndChain(
  admin: SupabaseClient,
  planId: string,
  userId: string,
  input: GenerateInput,
): Promise<void> {
  const setError = (message: string) =>
    admin.from("training_plans")
      .update({ generation_status: "error", generation_error: message })
      .eq("id", planId)

  const t0 = Date.now()
  try {
    await withTimeout((async () => {
      const todayStr = todayISO()
      const raceDateStr = input.race.date
      const total = weeksUntil(todayStr, raceDateStr)

      const { count } = await admin
        .from("training_weeks")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", planId)
      const done = count ?? 0

      if (done >= total) {
        await admin.from("training_plans").update({ generation_status: "ready" }).eq("id", planId)
        return
      }

      const start = done + 1
      const end = Math.min(start + CHUNK_WEEKS - 1, total)
      const prior = await fetchPriorWeeks(admin, planId)
      const userPrompt = buildChunkUserPrompt(
        input, todayStr, total, start, end, startDateForWeek(todayStr, start), formatPriorWeeks(prior),
      )
      const system = buildSystemPrompt()

      let chunk = await timed(planId, `sonnet chunk ${start}-${end} + parse`, () =>
        generateAndParse(system, [{ role: "user", content: userPrompt }]))
      // Ne garder que les semaines demandées (évite tout conflit avec l'existant).
      chunk.weeks = (chunk.weeks ?? []).filter((w) => w.week_number >= start && w.week_number <= end)

      let errors = validatePlan(chunk, todayStr, raceDateStr, start)
      if (errors.length) {
        console.warn(`[generate-plan] ${planId} chunk ${start}-${end} invalide (essai 1) :`, errors.slice(0, 8))
        chunk = await timed(planId, `sonnet chunk ${start}-${end} retry`, () =>
          generateAndParse(system, [
            { role: "user", content: userPrompt },
            { role: "assistant", content: JSON.stringify(chunk) },
            { role: "user", content: buildRetryPrompt(errors) },
          ]))
        chunk.weeks = (chunk.weeks ?? []).filter((w) => w.week_number >= start && w.week_number <= end)
        errors = validatePlan(chunk, todayStr, raceDateStr, start)
      }
      if (errors.length) {
        console.error(`[generate-plan] ${planId} chunk ${start}-${end} invalide après retry :`, errors.slice(0, 8))
        await setError(`Chunk ${start}-${end} invalide : ${errors.slice(0, 6).join(" | ")}`)
        return
      }

      await timed(planId, `persist chunk ${start}-${end}`, () =>
        persistPlan(admin, planId, userId, expandPlan(chunk)))

      // Le résumé global n'est produit que par le premier chunk.
      if (start === 1 && chunk.summary) {
        await admin.from("training_plans").update({ summary: chunk.summary }).eq("id", planId)
      }

      if (end >= total) {
        await admin.from("training_plans").update({ generation_status: "ready" }).eq("id", planId)
        console.log(`[generate-plan] ${planId} prêt (${total} semaines) — dernier chunk ${start}-${end}`)
      } else {
        console.log(`[generate-plan] ${planId} chunk ${start}-${end}/${total} ok en ${Date.now() - t0} ms → chaînage`)
        await selfInvokeContinue(planId)
      }
    })(), TASK_TIMEOUT_MS, "Génération trop longue, réessayez")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[generate-plan] ${planId} erreur (${Date.now() - t0} ms) :`, message)
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
  } catch {
    return json(400, { error: "Corps JSON invalide" })
  }

  // ── Auto-invocation interne : chunk suivant ─────────────────────────────────
  if (body?.continue_plan_id) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    if (authHeader !== `Bearer ${serviceKey}`) return json(401, { error: "Unauthorized (continuation)" })

    const planId = body.continue_plan_id as string
    const { data: row } = await supabaseAdmin
      .from("training_plans")
      .select("id, user_id, race_name, race_date, race_distance_m, race_elevation_m, goal_time_sec, fitness_snapshot, previous_races, notes, generation_status")
      .eq("id", planId)
      .single()
    if (!row) return json(404, { error: "Plan introuvable" })
    if (row.generation_status !== "generating") return json(200, { ok: true, skipped: true })

    EdgeRuntime.waitUntil(runChunkAndChain(supabaseAdmin, planId, row.user_id as string, inputFromPlanRow(row)))
    return json(200, { ok: true })
  }

  // ── Requête utilisateur : premier chunk ─────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })

  const inputError = validateInput(body)
  if (inputError) return json(400, { error: inputError })
  const input = body as unknown as GenerateInput

  // Refuser si un plan actif existe déjà.
  const { data: active } = await supabaseAdmin
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (active) return json(409, { error: "Un plan actif existe déjà", plan_id: active.id })

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
    if (insertError?.code === "23505") return json(409, { error: "Un plan actif existe déjà" })
    console.error("[generate-plan] insert plan error:", JSON.stringify(insertError))
    return json(500, { error: "Impossible de créer le plan", detail: insertError?.message })
  }

  EdgeRuntime.waitUntil(runChunkAndChain(supabaseAdmin, newPlan.id, user.id, input))
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
