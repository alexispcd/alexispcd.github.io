// Envoi / retrait d'une seance de course vers Intervals.icu (category WORKOUT),
// qui synchronise ensuite vers la montre Coros. Declenchement manuel, une seance
// a la fois. Auth JWT utilisateur (meme pattern qu'adapt-sessions), puis client
// service_role pour lire et mettre a jour la seance.
//
// Le body porte un champ action optionnel : "push" (defaut) envoie ou renvoie la
// seance, "remove" la retire de la montre.

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

  // 2. Corps (action "push" par defaut pour ne pas casser les appels existants)
  let sessionId: string
  let action: "push" | "remove"
  let pushDate: string
  try {
    const body = await req.json()
    sessionId = body.session_id
    if (!sessionId) throw new Error("session_id requis")
    action = body.action === "remove" ? "remove" : "push"
    pushDate = resolvePushDate(body.push_date)
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Configuration Intervals.icu (secrets projet)
  const apiKey = Deno.env.get("ICU_API_KEY")
  const athleteId = Deno.env.get("ICU_ATHLETE_ID")
  if (!apiKey || !athleteId) return json(500, { error: "Configuration Intervals.icu manquante" })

  const base = `https://intervals.icu/api/v1/athlete/${athleteId}`
  const icuHeaders = {
    "Content-Type": "application/json",
    "Authorization": "Basic " + btoa(`API_KEY:${apiKey}`),
  }

  // 4. Seance
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("training_sessions")
    .select(`id, title, type, status, intervals_event_id, session_steps(${STEP_COLS})`)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (rowErr || !row) return json(404, { error: "Seance introuvable" })

  const existingId = (row.intervals_event_id as string | null) ?? null

  // ── Retrait de la montre ────────────────────────────────────────────────────
  if (action === "remove") {
    if (!existingId) return json(400, { error: "Cette seance n'est pas sur la montre" })

    let res: Response
    try {
      res = await fetch(`${base}/events/${existingId}`, { method: "DELETE", headers: icuHeaders })
    } catch (err) {
      return json(502, { error: "Appel Intervals.icu impossible", detail: err instanceof Error ? err.message : String(err) })
    }
    // 404 = event deja absent cote Intervals : objectif atteint, donc succes.
    if (!res.ok && res.status !== 404) {
      const t = await res.text()
      console.error(`[push-to-intervals] DELETE Intervals ${res.status}: ${t.slice(0, 500)}`)
      return json(502, { error: `Intervals.icu a repondu ${res.status}`, detail: t.slice(0, 500) })
    }

    const { error: updErr } = await supabaseAdmin
      .from("training_sessions")
      .update({ intervals_event_id: null, pushed_at: null })
      .eq("id", sessionId)
      .eq("user_id", user.id)
    if (updErr) return json(500, { error: "Mise a jour de la seance impossible", detail: updErr.message })

    return json(200, { intervals_event_id: null, pushed_at: null })
  }

  // ── Envoi vers la montre ────────────────────────────────────────────────────
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

  // target "PACE" impose la metrique directrice cote Intervals : sans lui,
  // l'event herite du workout_order des sport settings (POWER en tete) et la
  // montre recoit des steps sans intensite. On ne touche pas aux sport settings.
  // start_date_local vient de push_date, jamais de scheduled_date (plan inchange).
  const payload = {
    category: "WORKOUT",
    type: "Run",
    target: "PACE",
    start_date_local: `${pushDate}T00:00:00`,
    name,
    description,
    external_id: sessionId,
  }

  // PUT si event existant (deplacement sans doublon), POST sinon. Un PUT en 404
  // signifie que l'event a ete supprime manuellement cote Intervals.icu : on
  // remet l'id a null en base et on recree via un POST, une seule fois.
  let res: Response
  let recreated = false
  try {
    if (existingId) {
      res = await fetch(`${base}/events/${existingId}`, { method: "PUT", headers: icuHeaders, body: JSON.stringify(payload) })
      if (res.status === 404) {
        console.warn(`[push-to-intervals] event Intervals.icu ${existingId} introuvable, recreation`)
        await supabaseAdmin.from("training_sessions").update({ intervals_event_id: null }).eq("id", sessionId).eq("user_id", user.id)
        recreated = true
        res = await fetch(`${base}/events`, { method: "POST", headers: icuHeaders, body: JSON.stringify(payload) })
      }
    } else {
      res = await fetch(`${base}/events`, { method: "POST", headers: icuHeaders, body: JSON.stringify(payload) })
    }
  } catch (err) {
    return json(502, { error: "Appel Intervals.icu impossible", detail: err instanceof Error ? err.message : String(err) })
  }

  const bodyText = await res.text()
  if (!res.ok) {
    // On remonte le status et le corps d'Intervals, jamais la cle d'API.
    console.error(`[push-to-intervals] Intervals ${res.status}: ${bodyText.slice(0, 500)}`)
    return json(502, { error: `Intervals.icu a repondu ${res.status}`, detail: bodyText.slice(0, 500) })
  }

  // Apres recreation, l'ancien id ne vaut plus rien : on repart de l'id du POST.
  let eventId = recreated ? null : existingId
  try {
    const parsed = JSON.parse(bodyText) as { id?: number | string }
    if (parsed?.id != null) eventId = String(parsed.id)
  } catch {
    // Corps non JSON (rare) : on conserve l'id courant s'il y en a un.
  }

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
