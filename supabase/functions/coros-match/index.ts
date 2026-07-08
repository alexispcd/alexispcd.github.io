import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import { anthropicWithCoros } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const TZ = "Europe/Paris"
const RUNNING_SPORT_CODE = 100

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

/** yyyy-MM-dd → timestamp UTC minuit, ou NaN. */
function dayTs(d: unknown): number {
  if (typeof d !== "string") return NaN
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3])
}

/** Décale une date yyyy-MM-dd de n jours et renvoie yyyyMMdd (format Coros). */
function shiftToCompact(dateStr: string, days: number): string {
  const ts = dayTs(dateStr) + days * 86_400_000
  return new Date(ts).toISOString().slice(0, 10).replace(/-/g, "")
}

interface RawRecord {
  labelId?: string
  date?: string
  distance_m?: number
  duration_sec?: number
  avg_hr?: number | null
}

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
    .select("id, scheduled_date, type")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (sessionErr || !session) return json(404, { error: "Séance introuvable" })
  if (!session.scheduled_date) return json(422, { error: "Séance sans date planifiée" })

  // 3. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return json(503, { error: "Coros authentication required", detail })
  }

  // 4. Fenêtre ±2 jours autour de la date planifiée
  const startDate = shiftToCompact(session.scheduled_date, -2)
  const endDate = shiftToCompact(session.scheduled_date, 2)

  // 5. Appel MCP (querySportRecords uniquement) — le modèle relaie les données brutes,
  //    aucune décision IA : le tri et la normalisation sont faits en code.
  const system =
    "Tu es un relais de données Coros. Tu appelles l'outil MCP demandé et tu retournes " +
    "ses données brutes au format JSON strict, sans interprétation, sans arrondi, sans invention. " +
    "Réponds UNIQUEMENT avec le JSON, commence par { et termine par }."

  const userMessage = [
    `Appelle querySportRecords avec startDate=${startDate}, endDate=${endDate}, limit=20, ` +
      `sportTypeCodes=[${RUNNING_SPORT_CODE}], timezone=${TZ}.`,
    "Retourne chaque activité au format :",
    JSON.stringify({
      records: [{
        labelId: "identifiant labelId de l'activité (string)",
        date: "date de l'activité au format yyyy-MM-dd",
        distance_m: "distance totale en MÈTRES (nombre)",
        duration_sec: "durée totale en SECONDES (nombre)",
        avg_hr: "FC moyenne en bpm (nombre) ou null si absente",
      }],
    }),
    "Si aucune activité, retourne {\"records\":[]}.",
  ].join("\n")

  let rawText: string
  try {
    rawText = await anthropicWithCoros({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userMessage }],
      corosToken,
      tools: ["querySportRecords"],
    })
  } catch (err) {
    console.error("[coros-match] Anthropic/MCP error:", err instanceof Error ? err.message : err)
    return json(502, { error: "Erreur lors de la récupération des activités Coros" })
  }

  let parsed: { records?: RawRecord[] }
  try {
    parsed = JSON.parse(extractJson(rawText))
  } catch (err) {
    console.error("[coros-match] JSON parse error:", err, "raw:", rawText.slice(0, 300))
    return json(200, { candidates: [] })
  }

  // 6. Normalisation + tri par proximité de date (en code)
  const targetTs = dayTs(session.scheduled_date)
  const candidates = (parsed.records ?? [])
    .filter((r) => r.labelId)
    .map((r) => {
      const distance_m = typeof r.distance_m === "number" ? r.distance_m : null
      const duration_sec = typeof r.duration_sec === "number" ? r.duration_sec : null
      const avg_pace_sec = distance_m && distance_m > 0 && duration_sec
        ? Math.round(duration_sec / (distance_m / 1000))
        : null
      return {
        labelId: r.labelId!,
        date: r.date ?? null,
        distance_m,
        duration_sec,
        avg_pace_sec,
        avg_hr: typeof r.avg_hr === "number" ? r.avg_hr : null,
      }
    })
    .sort((a, b) => {
      const da = Math.abs(dayTs(a.date) - targetTs)
      const db = Math.abs(dayTs(b.date) - targetTs)
      if (Number.isNaN(da) && Number.isNaN(db)) return 0
      if (Number.isNaN(da)) return 1
      if (Number.isNaN(db)) return -1
      return da - db
    })

  return json(200, { candidates })
}
