import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireModule } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { callCorosTool } from "../_shared/coros-mcp.ts"
import { buildCorosCourse, CorosCourseError } from "../_shared/training/coros-course.ts"
import {
  corosTokenProvider,
  CorosNotConnectedError,
  isUpcoming,
  parseIdInPlan,
  syncCorosCopy,
  toCorosDate,
} from "../_shared/training/coros-sync.ts"
import { addDaysISO, dayTs, todayISO } from "../_shared/training/weeks.ts"
import type { PlanStep } from "../_shared/training/types.ts"

// Envoi d'une séance de course vers la montre via le MCP Coros, par utilisateur.
//   push   { session_id, date }  crée une copie planifiée à la date choisie ;
//   update { session_id }        remplace le contenu de la copie existante.
// Le MCP ne sait ni déplacer ni supprimer une séance planifiée : ces cas
// renvoient l'utilisateur vers l'app Coros. Le texte des erreurs Coros n'est
// jamais renvoyé au client.

/** Coros accepte une date d'aujourd'hui à J+90 inclus. */
const PUSH_WINDOW_DAYS = 90
const STEP_COLS = "order_index, step_type, repeat_group, repeat_index, target_pace_sec, pace_tolerance_sec, distance_m, duration_sec"
const NOT_CONNECTED = {
  error: "Coros non connecté",
  detail: "Connecte ton compte Coros dans les réglages pour envoyer des séances sur ta montre.",
  code: "coros_not_connected",
}

const json = (status: number, body: unknown) => Response.json(body, { status })

const hasCorosToken = async (admin: SupabaseClient, userId: string): Promise<boolean> => {
  const { data } = await admin.from("coros_tokens").select("user_id").eq("user_id", userId).maybeSingle()
  return Boolean(data)
}

async function handlePush(admin: SupabaseClient, userId: string, sessionId: string, date: unknown): Promise<Response> {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dayTs(date))) {
    return json(400, { error: "Date invalide (yyyy-MM-dd attendu)" })
  }
  const today = todayISO()
  const maxDate = addDaysISO(today, PUSH_WINDOW_DAYS)
  if (dayTs(date) < dayTs(today) || dayTs(date) > dayTs(maxDate)) {
    return json(400, { error: "Date hors fenêtre", detail: "Choisis une date entre aujourd'hui et dans 90 jours." })
  }

  const { data: session, error } = await admin
    .from("training_sessions")
    .select(`id, type, status, title, rationale, coros_workout_id, coros_workout_date, session_steps(${STEP_COLS})`)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !session) return json(404, { error: "Séance introuvable" })
  if (session.status !== "planned" && session.status !== "adapted") {
    return json(409, { error: "Séance non envoyable", detail: "Seules les séances à venir ou adaptées peuvent être envoyées." })
  }

  let course
  try {
    course = buildCorosCourse(session, (session.session_steps ?? []) as PlanStep[])
  } catch (err) {
    if (err instanceof CorosCourseError) {
      return json(422, { error: "Séance impossible à convertir pour la montre", detail: err.message })
    }
    throw err
  }

  if (!(await hasCorosToken(admin, userId))) return json(409, NOT_CONNECTED)

  let idInPlan: string | null
  try {
    const token = await corosTokenProvider(admin, userId)()
    const text = await callCorosTool(token, "createScheduledWorkout", { date: toCorosDate(date), course })
    idInPlan = parseIdInPlan(text)
    if (!idInPlan) console.error("[coros-push] idInPlan absent de la réponse:", text.slice(0, 300))
  } catch (err) {
    if (err instanceof CorosNotConnectedError) return json(409, NOT_CONNECTED)
    console.error("[coros-push] create échec:", err instanceof Error ? err.message.slice(0, 300) : err)
    return json(502, { error: "Envoi vers la montre impossible pour le moment" })
  }
  if (!idInPlan) {
    return json(502, {
      error: "Réponse Coros inattendue",
      detail: "La séance a peut-être été créée : vérifie dans l'app Coros avant de renvoyer.",
    })
  }

  // La copie précédente, si elle existe, reste sur la montre : le MCP ne sait
  // pas la supprimer. On le signale pour que l'UI prévienne l'utilisateur.
  const previousCopy = session.coros_workout_id
    ? { date: session.coros_workout_date as string | null, upcoming: isUpcoming(session.coros_workout_date) }
    : null

  const pushedAt = new Date().toISOString()
  const patch = {
    coros_workout_id: idInPlan,
    coros_workout_date: date,
    coros_pushed_at: pushedAt,
    coros_sync_error: null,
  }
  const { error: updErr } = await admin.from("training_sessions").update(patch).eq("id", sessionId).eq("user_id", userId)
  if (updErr) {
    console.error("[coros-push] écriture échec", sessionId, updErr.message)
    return json(500, { error: "Séance envoyée mais non enregistrée", detail: "Elle est sur ta montre, mais l'app ne le sait pas." })
  }

  return json(200, { ...patch, previous_copy: previousCopy })
}

async function handleUpdate(admin: SupabaseClient, userId: string, sessionId: string): Promise<Response> {
  const { data: session, error } = await admin
    .from("training_sessions")
    .select("id, coros_workout_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !session) return json(404, { error: "Séance introuvable" })
  if (!session.coros_workout_id) return json(400, { error: "Cette séance n'est pas sur la montre" })
  if (!(await hasCorosToken(admin, userId))) return json(409, NOT_CONNECTED)

  const result = await syncCorosCopy(admin, userId, sessionId)
  return json(200, result)
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
  const denied = await requireModule(supabaseAdmin, user.id, "training")
  if (denied) return denied

  // 2. Corps
  let body: { action?: unknown; session_id?: unknown; date?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Corps invalide" })
  }
  if (typeof body.session_id !== "string" || !body.session_id) return json(400, { error: "session_id requis" })

  if (body.action === "push") return await handlePush(supabaseAdmin, user.id, body.session_id, body.date)
  if (body.action === "update") return await handleUpdate(supabaseAdmin, user.id, body.session_id)
  return json(400, { error: "Action inconnue" })
}

Deno.serve(withCors(async (req) => {
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[coros-push] uncaught:", message)
    return json(500, { error: "Internal server error" })
  }
}))
