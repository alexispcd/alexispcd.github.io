import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import { callCorosTool } from "../_shared/coros-mcp.ts"
import { parseSportRecords } from "../_shared/coros-parse.ts"
import { dayTs, mondayOf, sundayOf, todayISO } from "../_shared/training/weeks.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// 100 = course à pied, 102 = trail : on veut les deux comme candidats à la liaison.
// Doit rester un TABLEAU : un scalaire fait échouer l'appel Coros.
const SPORT_CODES = [100, 102]

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

/** yyyy-MM-dd → yyyyMMdd (format Coros). */
const toCompact = (iso: string) => iso.replace(/-/g, "")

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[coros-match] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})

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

  // 2. Corps + séance
  let sessionId: string
  try {
    const body = await req.json()
    sessionId = body.session_id
    if (!sessionId) throw new Error("session_id requis")
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, scheduled_date, type, training_weeks(start_date)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (sessionErr || !session) return json(404, { error: "Séance introuvable" })

  // 3. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return json(503, { error: "Coros authentication required", detail })
  }

  // 4. Fenêtre de candidats = la semaine de la séance (lundi→dimanche de sa
  //    training_week), bornée à aujourd'hui. Fallback : semaine de la scheduled_date.
  const weekStart = (session.training_weeks as { start_date?: string | null } | null)?.start_date ?? null
  const anchor = weekStart ?? session.scheduled_date
  if (!anchor) return json(422, { error: "Séance sans semaine ni date planifiée" })
  const todayStr = todayISO()
  const mondayStr = mondayOf(anchor)
  const sundayStr = sundayOf(anchor)
  // Ne pas chercher au-delà d'aujourd'hui (séances à venir non encore réalisées).
  const endStr = dayTs(sundayStr) > dayTs(todayStr) ? todayStr : sundayStr
  const startDate = toCompact(mondayStr)
  const endDate = toCompact(dayTs(endStr) < dayTs(mondayStr) ? mondayStr : endStr)

  // 5. Appel MCP direct a querySportRecords (aucun LLM). Les dix parametres du
  //    schema sont declares required : un appel partiel est rejete. Les bornes
  //    hautes a 0 valent "pas de borne", verifie par appel reel.
  let records
  try {
    const text = await callCorosTool(corosToken, "querySportRecords", {
      startDate,
      endDate,
      sportTypeCodes: SPORT_CODES,
      minDistanceKm: 0,
      maxDistanceKm: 0,
      minDurationMinutes: 0,
      maxDurationMinutes: 0,
      maxAveragePace: "null",
      locationKeyword: "null",
      limit: 20,
    })
    // Un format devenu illisible doit remonter en 502 : renvoyer une liste vide
    // ferait passer une panne pour une absence d'activité.
    records = parseSportRecords(text)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[coros-match] Coros error:", detail)
    return json(502, { error: "Erreur lors de la récupération des activités Coros", detail })
  }

  // 6. Tri par proximité de date (en code). Le parseur garantit déjà les types,
  //    seule l'allure reste à dériver.
  const targetTs = dayTs(session.scheduled_date ?? anchor)
  const candidates = records
    .map((r) => ({
      labelId: r.labelId,
      date: r.date,
      startTimestamp: r.startTimestamp,
      sport_type: r.sport_type,
      distance_m: r.distance_m,
      duration_sec: r.duration_sec,
      avg_pace_sec: r.distance_m && r.distance_m > 0 && r.duration_sec
        ? Math.round(r.duration_sec / (r.distance_m / 1000))
        : null,
      avg_hr: r.avg_hr,
    }))
    .sort((a, b) => Math.abs(dayTs(a.date) - targetTs) - Math.abs(dayTs(b.date) - targetTs))

  return json(200, { candidates })
}
