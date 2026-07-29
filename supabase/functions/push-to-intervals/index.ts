// Envoie une seance de course planifiee vers Intervals.icu (category WORKOUT),
// qui la synchronise ensuite vers la montre Coros. Declenchement manuel, une
// seance a la fois. Auth JWT utilisateur (meme pattern qu'adapt-sessions), puis
// client service_role pour lire et mettre a jour la seance.

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { buildWorkoutDescription } from "../_shared/training/intervals.ts"
import { dayTs, todayISO } from "../_shared/training/weeks.ts"
import type { PlanStep } from "../_shared/training/types.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

const STEP_COLS = "order_index, step_type, repeat_group, repeat_index, target_pace_sec, pace_tolerance_sec, distance_m, duration_sec"
// Seule une seance a venir (planifiee ou adaptee) peut etre envoyee.
const PUSHABLE = new Set(["planned", "adapted"])

/**
 * Date d'envoi (yyyy-MM-dd) : le push_date du body s'il est valide, sinon la date
 * du jour en Europe/Paris. Une valeur presente mais invalide est logguee (warn)
 * et n'entraine pas d'erreur.
 */
function resolvePushDate(raw: unknown): string {
  const today = todayISO()
  if (raw == null) return today
  if (typeof raw === "string" && !Number.isNaN(dayTs(raw))) return raw.slice(0, 10)
  console.warn(`[push-to-intervals] push_date invalide (${JSON.stringify(raw)}), repli sur ${today}`)
  return today
}

async function handleRequest(req: Request): Promise<Response> {
  // 1. Auth utilisateur
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
  let pushDate: string
  try {
    const body = await req.json()
    sessionId = body.session_id
    if (!sessionId) throw new Error("session_id requis")
    pushDate = resolvePushDate(body.push_date)
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Configuration Intervals.icu (secrets projet)
  const apiKey = Deno.env.get("ICU_API_KEY")
  const athleteId = Deno.env.get("ICU_ATHLETE_ID")
  if (!apiKey || !athleteId) return json(500, { error: "Configuration Intervals.icu manquante" })

  // 4. Seance + steps ordonnes
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("training_sessions")
    .select(`id, title, type, status, intervals_event_id, session_steps(${STEP_COLS})`)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (rowErr || !row) return json(404, { error: "Seance introuvable" })

  if (row.type === "renfo") {
    return json(400, { error: "Une seance de renforcement ne s'envoie pas vers la montre" })
  }
  if (!PUSHABLE.has(row.status as string)) {
    return json(400, { error: "Seule une seance a venir peut etre envoyee vers la montre" })
  }

  const steps = ((row.session_steps ?? []) as PlanStep[])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const description = buildWorkoutDescription(steps)
  const name = (row.title as string) || "Seance"

  // start_date_local vient de push_date, jamais de scheduled_date (le plan
  // reste inchange). Sur re-envoi (PUT), l'event existant est deplace a cette
  // date sans creer de doublon.
  const payload = {
    category: "WORKOUT",
    type: "Run",
    start_date_local: `${pushDate}T00:00:00`,
    name,
    description,
    external_id: sessionId,
  }

  // 5. POST si nouveau, PUT si deja pousse (evite un doublon apres adaptation).
  const base = `https://intervals.icu/api/v1/athlete/${athleteId}`
  const existingId = (row.intervals_event_id as string | null) ?? null
  const url = existingId ? `${base}/events/${existingId}` : `${base}/events`
  const method = existingId ? "PUT" : "POST"
  const auth = "Basic " + btoa(`API_KEY:${apiKey}`)

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return json(502, { error: "Appel Intervals.icu impossible", detail: err instanceof Error ? err.message : String(err) })
  }

  const bodyText = await res.text()
  if (!res.ok) {
    // On remonte le status et le corps d'Intervals, jamais la cle d'API.
    console.error(`[push-to-intervals] Intervals ${res.status}: ${bodyText.slice(0, 500)}`)
    return json(502, { error: `Intervals.icu a repondu ${res.status}`, detail: bodyText.slice(0, 500) })
  }

  let eventId = existingId
  try {
    const parsed = JSON.parse(bodyText) as { id?: number | string }
    if (parsed?.id != null) eventId = String(parsed.id)
  } catch {
    // Corps non JSON (rare) : on conserve l'id existant s'il y en a un.
  }

  // 6. Persistance sur la seance
  const pushedAt = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin
    .from("training_sessions")
    .update({ intervals_event_id: eventId, pushed_at: pushedAt })
    .eq("id", sessionId)
    .eq("user_id", user.id)
  if (updErr) return json(500, { error: "Mise a jour de la seance impossible", detail: updErr.message })

  return json(200, { intervals_event_id: eventId, pushed_at: pushedAt })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[push-to-intervals] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})
