import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireModule } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { errorMessage, internalError } from "../_shared/http.ts"
import { availableExercises } from "../_shared/strength/catalog.ts"
import { generateSessions, loadStrengthSetup, PROFILE_MISSING } from "../_shared/strength/generate.ts"
import { buildCycleWeekPrompt, buildSystemPrompt, type PriorSession } from "../_shared/strength/prompt.ts"
import { KINDS_BY_FREQUENCY, type MainItem, type SessionKind } from "../_shared/strength/rules.ts"
import { addDaysISO, dayTs, mondayOf, todayISO } from "../_shared/training/weeks.ts"

// Global fourni par le runtime Supabase. edge-runtime.d.ts est importé plus haut mais
// ses déclarations globales ne sont pas vues par deno check : déclaration locale, typage seul.
declare const EdgeRuntime: { waitUntil<T>(promise: Promise<T>): Promise<T> }

// Un cycle = 4 semaines, une semaine par appel modèle. La semaine suivante est
// déclenchée par une auto-invocation, l'avancement étant lu dans generated_weeks :
// chaque invocation reprend là où la précédente s'est arrêtée.
const WEEKS_PER_CYCLE = 4
const MAX_TOKENS = 8000
// Filet applicatif, sous la limite runtime : une semaine qui traîne devient une erreur.
const TASK_TIMEOUT_MS = 120_000

type MainExercises = Partial<Record<SessionKind, string[]>>

interface CycleRow {
  id: string
  user_id: string
  number: number
  start_date: string
  frequency: 1 | 2 | 3
  generated_weeks: number
  main_exercises: MainExercises | null
}

const json = (status: number, body: unknown) => Response.json(body, { status })

/** Rejette après `ms` (garde-fou anti-blocage). */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([p, guard]).finally(() => clearTimeout(timer))
}

/** Déclenche l'invocation de la semaine suivante (auth service_role interne). */
async function selfInvokeContinue(cycleId: string): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/renfo-cycle`
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ continue_cycle_id: cycleId }),
  })
}

/**
 * Génère et enregistre la semaine suivante du cycle, puis chaîne (ou clôt la génération).
 * Échec : generation_status = error, cause dans les logs uniquement.
 */
async function runWeekAndChain(admin: SupabaseClient, cycleId: string): Promise<void> {
  const tag = `[renfo-cycle] ${cycleId}`
  const setError = () => admin.from("strength_cycles").update({ generation_status: "error" }).eq("id", cycleId)

  try {
    await withTimeout((async () => {
      const { data: cycle, error: cycleError } = await admin
        .from("strength_cycles")
        .select("id, user_id, number, start_date, frequency, generated_weeks, main_exercises")
        .eq("id", cycleId)
        .single<CycleRow>()
      if (cycleError || !cycle) throw new Error(`cycle introuvable : ${cycleError?.message}`)

      if (cycle.generated_weeks >= WEEKS_PER_CYCLE) {
        await admin.from("strength_cycles").update({ generation_status: "ready" }).eq("id", cycleId)
        return
      }
      const week = cycle.generated_weeks + 1

      const setup = await loadStrengthSetup(admin, cycle.user_id)
      if (!setup) throw new Error("profil renfo absent")

      const kinds = KINDS_BY_FREQUENCY[cycle.frequency]
      if (!kinds) throw new Error(`fréquence inconnue : ${cycle.frequency}`)

      let mainSlugs: MainExercises | null = null
      if (week > 1) {
        mainSlugs = cycle.main_exercises
        const missing = kinds.filter((k) => !mainSlugs?.[k]?.length)
        if (missing.length) throw new Error(`exercices principaux absents pour ${missing.join(", ")}`)
      }

      // Reprise : retire une éventuelle semaine partiellement enregistrée.
      const { error: cleanError } = await admin
        .from("strength_sessions").delete().eq("cycle_id", cycleId).eq("week_index", week)
      if (cleanError) throw new Error(`nettoyage semaine ${week} : ${cleanError.message}`)

      const { data: priorRows, error: priorError } = await admin
        .from("strength_sessions")
        .select("week_index, kind, title, content")
        .eq("cycle_id", cycleId)
        .order("week_index")
        .order("position")
      if (priorError) throw new Error(`séances du cycle : ${priorError.message}`)

      let previousMain: MainExercises | null = null
      if (week === 1 && cycle.number > 1) {
        const { data: previous } = await admin
          .from("strength_cycles")
          .select("main_exercises")
          .eq("user_id", cycle.user_id)
          .eq("number", cycle.number - 1)
          .maybeSingle()
        previousMain = (previous?.main_exercises as MainExercises | null) ?? null
      }

      const t0 = Date.now()
      const result = await generateSessions({
        system: buildSystemPrompt(availableExercises(setup.equipment, setup.bandsKg), setup.bandsKg),
        userPrompt: buildCycleWeekPrompt({
          kinds, week, mainSlugs, prior: (priorRows ?? []) as PriorSession[], previousMain,
        }),
        kinds,
        setup,
        mainSlugs,
        maxTokens: MAX_TOKENS,
        logTag: `${tag} semaine ${week}`,
      })
      console.log(`${tag} semaine ${week} : modèle ${Date.now() - t0} ms`)
      if (!result.ok) throw new Error(`semaine ${week} invalide après retry : ${result.errors.slice(0, 8).join(" | ")}`)

      const weekStart = addDaysISO(cycle.start_date, 7 * (week - 1))
      const rows = result.sessions.map((s, position) => ({
        user_id: cycle.user_id,
        cycle_id: cycleId,
        week_index: week,
        week_start: weekStart,
        position,
        kind: s.kind,
        title: s.content.title,
        content: s.content,
      }))
      const { error: insertError } = await admin.from("strength_sessions").insert(rows)
      if (insertError) throw new Error(`insertion semaine ${week} : ${insertError.message}`)

      const update: Record<string, unknown> = { generated_weeks: week }
      if (week === 1) {
        update.main_exercises = Object.fromEntries(result.sessions.map((s) => {
          const main = s.content.blocks.find((b) => b.type === "main")
          const items = (main?.type === "main" ? main.items : []) as MainItem[]
          return [s.kind, items.map((i) => i.slug)]
        }))
      }
      if (week >= WEEKS_PER_CYCLE) update.generation_status = "ready"
      const { error: updateError } = await admin.from("strength_cycles").update(update).eq("id", cycleId)
      if (updateError) throw new Error(`mise à jour du cycle : ${updateError.message}`)

      if (week < WEEKS_PER_CYCLE) {
        await selfInvokeContinue(cycleId)
      } else {
        console.log(`${tag} prêt`)
      }
    })(), TASK_TIMEOUT_MS, "génération trop longue")
  } catch (err) {
    console.error(tag, errorMessage(err))
    await setError()
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

  // ── Auto-invocation interne : semaine suivante ──────────────────────────────
  if (body?.continue_cycle_id) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    if (authHeader !== `Bearer ${serviceKey}`) return json(401, { error: "Unauthorized (continuation)" })

    const cycleId = body.continue_cycle_id as string
    const { data: row } = await supabaseAdmin
      .from("strength_cycles")
      .select("id, generation_status")
      .eq("id", cycleId)
      .maybeSingle()
    if (!row) return json(404, { error: "Cycle introuvable" })
    if (row.generation_status !== "generating") return json(200, { ok: true, skipped: true })

    EdgeRuntime.waitUntil(runWeekAndChain(supabaseAdmin, cycleId))
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
  const denied = await requireModule(supabaseAdmin, user.id, "renfo")
  if (denied) return denied

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("strength_profiles")
    .select("frequency")
    .eq("user_id", user.id)
    .maybeSingle()
  if (profileError) return internalError("renfo-cycle", profileError.message)
  if (!profile) return json(409, PROFILE_MISSING)

  const { data: active, error: activeError } = await supabaseAdmin
    .from("strength_cycles")
    .select("id, start_date, generation_status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (activeError) return internalError("renfo-cycle", activeError.message)

  const today = todayISO()
  if (active) {
    if (active.generation_status === "generating") {
      return json(409, { error: "Le cycle est déjà en cours de génération", code: "cycle_generating", cycle_id: active.id })
    }
    if (active.generation_status === "error") {
      // Reprise là où la génération s'est arrêtée.
      const { error } = await supabaseAdmin
        .from("strength_cycles").update({ generation_status: "generating" }).eq("id", active.id)
      if (error) return internalError("renfo-cycle", error.message)
      EdgeRuntime.waitUntil(runWeekAndChain(supabaseAdmin, active.id))
      return json(202, { cycle_id: active.id })
    }
    if (dayTs(today) < dayTs(addDaysISO(active.start_date, 7 * WEEKS_PER_CYCLE))) {
      return json(409, { error: "Le cycle en cours n'est pas terminé", code: "cycle_in_progress", cycle_id: active.id })
    }
    const { error } = await supabaseAdmin
      .from("strength_cycles").update({ status: "completed" }).eq("id", active.id)
    if (error) return internalError("renfo-cycle", error.message)
  }

  const { data: last, error: lastError } = await supabaseAdmin
    .from("strength_cycles")
    .select("number")
    .eq("user_id", user.id)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) return internalError("renfo-cycle", lastError.message)

  const { data: cycle, error: insertError } = await supabaseAdmin
    .from("strength_cycles")
    .insert({
      user_id: user.id,
      number: (last?.number ?? 0) + 1,
      start_date: mondayOf(today),
      frequency: profile.frequency,
    })
    .select("id")
    .single()
  if (insertError || !cycle) {
    // Index unique partiel : une autre requête vient de créer le cycle actif.
    if (insertError?.code === "23505") {
      return json(409, { error: "Le cycle est déjà en cours de génération", code: "cycle_generating" })
    }
    return internalError("renfo-cycle", insertError?.message ?? "insert sans ligne")
  }

  EdgeRuntime.waitUntil(runWeekAndChain(supabaseAdmin, cycle.id))
  return json(202, { cycle_id: cycle.id })
}

Deno.serve(withCors(async (req) => {
  try {
    return await handleRequest(req)
  } catch (err) {
    return internalError("renfo-cycle", err)
  }
}))
