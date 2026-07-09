import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import { anthropicSimple, anthropicWithCoros } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { type Comparison, type Lap, matchStepsToLaps, type Step } from "./match.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RUNNING_SPORT_CODE = 100
const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

function paceStr(sec: number | null): string {
  if (sec == null) return "libre"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, "0")}/km`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[complete-session] uncaught:", message)
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

  // 2. Corps
  let sessionId: string
  let corosActivityId: string | null
  try {
    const body = await req.json()
    sessionId = body.session_id
    corosActivityId = body.coros_activity_id ?? null
    if (!sessionId) throw new Error("session_id requis")
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Séance + steps ordonnés
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, type, title, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (sessionErr || !session) return json(404, { error: "Séance introuvable" })
  if (session.status === "done") return json(409, { error: "Séance déjà complétée" })

  // 4. Cas sans Coros : validation manuelle simple.
  if (!corosActivityId) {
    return await manualComplete(supabaseAdmin, sessionId)
  }

  // 5. Renfo : pas de matching Coros possible.
  if (session.type === "renfo") {
    return json(400, { error: "Une séance de renfo se valide sans Coros (envoie sans coros_activity_id)" })
  }

  const { data: stepsRows, error: stepsErr } = await supabaseAdmin
    .from("session_steps")
    .select("order_index, step_type, target_pace_sec, pace_tolerance_sec, distance_m, duration_sec")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
  if (stepsErr) return json(500, { error: "Lecture des steps impossible", detail: stepsErr.message })
  const steps = (stepsRows ?? []) as Step[]

  // 6. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return json(503, { error: "Coros authentication required", detail })
  }

  // 7. UN appel MCP : queryActivityLapData uniquement. Le modèle relaie les laps bruts.
  const laps = await fetchLaps(corosToken, corosActivityId)

  // 8. Matching + comparaison (100% en code)
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps)

  // 9. Analyse IA (mode simple, pas de MCP). L'échec ne bloque pas la complétion.
  const { verdict, advice } = await analyze(session.type, session.title, steps, comparisons)

  const analysis = { verdict, advice, comparisons }

  // 10. Mise à jour de la séance
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("training_sessions")
    .update({
      coros_activity_id: corosActivityId,
      actual_laps: actualLaps,
      analysis,
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("*")
    .single()
  if (updateErr) return json(500, { error: "Mise à jour impossible", detail: updateErr.message })

  return json(200, { session: updated })
}

async function manualComplete(supabaseAdmin: SupabaseClient, sessionId: string): Promise<Response> {
  const { data: updated, error } = await supabaseAdmin
    .from("training_sessions")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single()
  if (error) return json(500, { error: "Mise à jour impossible", detail: error.message })
  return json(200, { session: updated })
}

/** Récupère les laps bruts via le connecteur MCP (queryActivityLapData uniquement). */
async function fetchLaps(corosToken: string, labelId: string): Promise<Lap[]> {
  const system =
    "Tu es un relais de données Coros. Tu appelles l'outil MCP demandé et tu retournes ses laps " +
    "au format JSON strict, dans l'ordre exact, sans interprétation, sans arrondi, sans invention. " +
    "Réponds UNIQUEMENT avec le JSON, commence par { et termine par }."
  const userMessage = [
    `Appelle queryActivityLapData avec labelId="${labelId}" et sportType=${RUNNING_SPORT_CODE}.`,
    "Retourne les laps dans l'ordre, chacun au format :",
    JSON.stringify({
      laps: [{
        distance_m: "distance du lap en MÈTRES (nombre)",
        duration_sec: "durée du lap en SECONDES (nombre)",
        avg_hr: "FC moyenne du lap en bpm (nombre) ou null",
      }],
    }),
    "Si aucun lap, retourne {\"laps\":[]}.",
  ].join("\n")

  let rawText: string
  try {
    rawText = await anthropicWithCoros({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
      corosToken,
      tools: ["queryActivityLapData"],
    })
  } catch (err) {
    console.error("[complete-session] MCP laps error:", err instanceof Error ? err.message : err)
    return []
  }

  let parsed: { laps?: Array<{ distance_m?: number; duration_sec?: number; avg_hr?: number | null }> }
  try {
    parsed = JSON.parse(extractJson(rawText))
  } catch (err) {
    console.error("[complete-session] laps JSON parse error:", err, "raw:", rawText.slice(0, 300))
    return []
  }

  return (parsed.laps ?? []).map((l) => {
    const distance_m = typeof l.distance_m === "number" ? l.distance_m : null
    const duration_sec = typeof l.duration_sec === "number" ? l.duration_sec : null
    const avg_pace_sec = distance_m && distance_m > 0 && duration_sec
      ? Math.round(duration_sec / (distance_m / 1000))
      : null
    return { distance_m, duration_sec, avg_pace_sec, avg_hr: typeof l.avg_hr === "number" ? l.avg_hr : null }
  })
}

interface AnalysisOut {
  verdict: "reussie" | "partiellement" | "a_retravailler" | null
  advice: string | null
}

/** Analyse IA (Haiku, mode simple). Renvoie { verdict: null, advice: null } si échec définitif. */
async function analyze(
  type: string,
  title: string,
  steps: Step[],
  comparisons: Comparison[],
): Promise<AnalysisOut> {
  const cmpByStep = new Map<number, Comparison>()
  for (const c of comparisons) cmpByStep.set(c.step_index, c)

  const lines = steps.map((s, i) => {
    const c = cmpByStep.get(i)
    if (!c) return `- Step ${i + 1} (${s.step_type}) : prévu ${paceStr(s.target_pace_sec)} — non réalisé`
    if (c.status === "free") return `- Step ${i + 1} (${s.step_type}) : récup, réalisé ${paceStr(c.actual_pace)}`
    const delta = c.delta_sec ?? 0
    const sign = delta > 0 ? "+" : ""
    return `- Step ${i + 1} (${s.step_type}) : prévu ${paceStr(c.planned_pace)}, réalisé ${paceStr(c.actual_pace)} (${sign}${delta}s → ${c.status})`
  })

  const nOk = comparisons.filter((c) => c.status === "ok").length
  const nEcart = comparisons.filter((c) => c.status === "ecart").length

  const system =
    "Tu es un coach running. À partir de la comparaison prévu/réalisé d'une séance, tu donnes un verdict " +
    "et un conseil concret. N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–) dans le conseil : " +
    "utilise \" : \", \" · \", une virgule ou reformule. Réponds UNIQUEMENT en JSON, commence par { et termine par }, format : " +
    '{"verdict":"reussie|partiellement|a_retravailler","advice":"2-3 phrases concrètes en français"}'

  const userPrompt = [
    `Séance : ${title} (type ${type})`,
    `Steps comparés : ${comparisons.length} — dans la cible : ${nOk}, en écart : ${nEcart}.`,
    "Détail :",
    ...lines,
  ].join("\n")

  const parseAnalysis = (raw: string): AnalysisOut | null => {
    try {
      const obj = JSON.parse(extractJson(raw))
      const verdict = ["reussie", "partiellement", "a_retravailler"].includes(obj.verdict) ? obj.verdict : null
      const advice = typeof obj.advice === "string" && obj.advice.trim() ? obj.advice.trim() : null
      if (!verdict || !advice) return null
      return { verdict, advice }
    } catch {
      return null
    }
  }

  try {
    const first = await anthropicSimple({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: userPrompt }],
    })
    const parsed = parseAnalysis(first)
    if (parsed) return parsed

    // 1 retry
    const retry = await anthropicSimple({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: first },
        { role: "user", content: "JSON invalide. Renvoie STRICTEMENT le JSON attendu, rien d'autre." },
      ],
    })
    const parsedRetry = parseAnalysis(retry)
    if (parsedRetry) return parsedRetry
  } catch (err) {
    console.error("[complete-session] analyse IA échouée:", err instanceof Error ? err.message : err)
  }

  // Échec définitif : la complétion reste valide sans analyse.
  return { verdict: null, advice: null }
}
