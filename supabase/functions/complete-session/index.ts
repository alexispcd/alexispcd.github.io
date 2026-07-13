import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import {
  type AnthropicResponse,
  anthropicSimple,
  anthropicWithCorosRaw,
  extractMcpToolResults,
} from "../_shared/anthropic.ts"
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

  // 7. UN appel MCP : queryActivityLapData uniquement. Les laps bruts sont
  //    parsés en code (le modèle n'est jamais la source des valeurs numériques).
  const lapsResult = await fetchLaps(corosToken, corosActivityId)
  if ("failure" in lapsResult) {
    // Données inexploitables : on n'écrit RIEN, la séance reste "planned".
    return json(422, { error: "Données Coros inexploitables", detail: lapsResult.failure })
  }
  const laps = lapsResult.laps

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

/** Bornes plausibles d'une allure de course, en s/km (2:00 à 15:00 par km). */
const PACE_MIN_SEC = 120
const PACE_MAX_SEC = 900

type LapsResult = { laps: Lap[] } | { failure: string }

/**
 * Récupère les laps via le connecteur MCP (queryActivityLapData) puis les parse
 * en code déterministe. Le LLM n'est qu'un déclencheur d'appel d'outil : sa
 * réponse texte est ignorée, seul le bloc mcp_tool_result est exploité.
 */
async function fetchLaps(corosToken: string, labelId: string): Promise<LapsResult> {
  const system =
    "Tu appelles l'outil MCP demandé, rien d'autre. Ta réponse texte sera ignorée : " +
    "seul l'appel d'outil compte. N'interprète pas, ne reformule pas, n'invente pas de données."
  const userMessage =
    `Appelle queryActivityLapData avec labelId="${labelId}" et sportType=${RUNNING_SPORT_CODE}.`

  let data: AnthropicResponse
  try {
    data = await anthropicWithCorosRaw({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMessage }],
      corosToken,
      tools: ["queryActivityLapData"],
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[complete-session] MCP laps error:", detail)
    return { failure: `Appel Coros en échec (${detail})` }
  }

  const results = extractMcpToolResults(data)
  const raw = results.join("\n")
  // Indispensable au premier run pour vérifier le schéma réel Coros.
  console.log("[complete-session] raw laps:", raw.slice(0, 2000))

  if (!raw.trim()) return { failure: "Réponse Coros vide (aucun résultat d'outil)" }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Plusieurs blocs concaténés ne forment pas un JSON valide : tenter le premier seul.
    try {
      parsed = JSON.parse(results[0] ?? "")
    } catch (err) {
      console.error("[complete-session] laps JSON parse error:", err instanceof Error ? err.message : err)
      return { failure: "Données Coros illisibles (JSON invalide)" }
    }
  }

  const rawLaps = findLapArray(parsed)
  if (!rawLaps || rawLaps.length === 0) {
    return { failure: "Aucun lap trouvé dans la réponse Coros" }
  }

  const laps = rawLaps.map(mapLap)
  if (laps.every((l) => l.avg_pace_sec == null)) {
    return { failure: "Aucune allure exploitable dans les laps Coros" }
  }
  return { laps }
}

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/** Premier champ numérique fini présent parmi les clés candidates. */
function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (isFiniteNum(obj[k])) return obj[k] as number
  }
  return null
}

function isObjArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 &&
    v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x))
}

const LAP_KEYS = ["laps", "lapList", "lapItemList"]

/**
 * Cherche le tableau de laps dans un payload de schéma inconnu : d'abord sous les
 * clés candidates (y compris data.laps / data.lapList via récursion), sinon le
 * premier tableau d'objets trouvé à profondeur <= 3.
 */
function findLapArray(root: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 3 || root === null || typeof root !== "object") return null
  if (isObjArray(root)) return root
  const obj = root as Record<string, unknown>

  for (const key of LAP_KEYS) {
    if (isObjArray(obj[key])) return obj[key] as Record<string, unknown>[]
  }
  for (const v of Object.values(obj)) {
    if (isObjArray(v)) return v as Record<string, unknown>[]
  }
  for (const v of Object.values(obj)) {
    const found = findLapArray(v, depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Mappe un lap brut Coros vers Lap. L'allure est TOUJOURS recalculée en code
 * (duration_sec / distance_km) : aucun champ de vitesse/allure fourni par Coros
 * n'est utilisé, car c'est précisément là que naissaient les valeurs absurdes.
 */
function mapLap(lap: Record<string, unknown>): Lap {
  let distance_m = pickNum(lap, ["distance", "distanceM", "lapDistance", "totalDistance"])
  let duration_sec = pickNum(lap, ["duration", "durationSec", "totalTime", "elapsedTime", "lapTime", "seconds"])
  const avg_hr = pickNum(lap, ["avgHeartRate", "avgHr", "averageHeartRate"])

  // Distance vraisemblablement en km (< 100) alors que *1000 donne une distance plausible.
  if (distance_m != null && distance_m < 100) {
    const asMeters = distance_m * 1000
    if (asMeters >= 100 && asMeters <= 100_000) distance_m = asMeters
  }
  // Durée vraisemblablement en millisecondes pour un lap (> 20000).
  if (duration_sec != null && duration_sec > 20_000) {
    duration_sec = Math.round(duration_sec / 1000)
  }

  let avg_pace_sec: number | null = null
  if (distance_m != null && distance_m > 0 && duration_sec != null && duration_sec > 0) {
    avg_pace_sec = Math.round(duration_sec / (distance_m / 1000))
    if (avg_pace_sec < PACE_MIN_SEC || avg_pace_sec > PACE_MAX_SEC) {
      console.warn(
        `[complete-session] allure hors bornes ${avg_pace_sec}s/km ` +
          `(dist=${distance_m}m, durée=${duration_sec}s) : mise à null`,
      )
      avg_pace_sec = null
    }
  }

  return { distance_m, duration_sec, avg_pace_sec, avg_hr }
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
