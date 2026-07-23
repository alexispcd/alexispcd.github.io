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

// ── Ressenti post-séance ──────────────────────────────────────────────────────
interface Feedback {
  rpe: number | null
  pain_areas: string[] | null
  feedback_note: string | null
}

/** Codes de zones (RpeForm) → libellés lisibles pour le prompt. */
const PAIN_LABELS: Record<string, string> = {
  mollet_g: "mollet gauche",
  mollet_d: "mollet droit",
  genou_g: "genou gauche",
  genou_d: "genou droit",
  achille_g: "tendon d'Achille gauche",
  achille_d: "tendon d'Achille droit",
  quadri_g: "cuisse gauche",
  quadri_d: "cuisse droite",
  tfl_g: "hanche/TFL gauche",
  tfl_d: "hanche/TFL droite",
  dos: "dos",
  autre: "autre",
}

/** Valide/normalise le ressenti reçu du client. null si rien d'exploitable. */
function parseFeedback(raw: unknown): Feedback | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>

  let rpe: number | null = null
  if (r.rpe != null) {
    const n = Number(r.rpe)
    if (Number.isInteger(n) && n >= 1 && n <= 10) rpe = n
  }

  let pain_areas: string[] | null = null
  if (Array.isArray(r.pain_areas)) {
    const arr = r.pain_areas.filter((x): x is string => typeof x === "string" && x.length > 0)
    pain_areas = arr.length ? arr : null
  }

  let feedback_note: string | null = null
  if (typeof r.feedback_note === "string" && r.feedback_note.trim()) {
    feedback_note = r.feedback_note.trim()
  }

  if (rpe == null && pain_areas == null && feedback_note == null) return null
  return { rpe, pain_areas, feedback_note }
}

/** Bloc "Ressenti athlète" pour les prompts Haiku (vide si aucun ressenti). */
function feedbackPromptBlock(fb: Feedback | null): string {
  if (!fb) return ""
  const parts: string[] = []
  if (fb.rpe != null) parts.push(`RPE (effort perçu) : ${fb.rpe}/10`)
  if (fb.pain_areas?.length) {
    parts.push(`Douleurs signalées : ${fb.pain_areas.map((c) => PAIN_LABELS[c] ?? c).join(", ")}`)
  }
  if (fb.feedback_note) parts.push(`Note de l'athlète : ${fb.feedback_note}`)
  if (!parts.length) return ""
  return ["", "Ressenti athlète :", ...parts.map((p) => `- ${p}`)].join("\n")
}

// ── Activités Coros sélectionnées ─────────────────────────────────────────────
/** Une activité Coros à lier, avec son horodatage de début (ms) si connu. */
interface SelectedActivity {
  id: string
  start_timestamp: number | null
}

// Garde-fou CPU : chaque activité coûte un appel MCP séquentiel.
const MAX_ACTIVITIES = 3

/**
 * Extrait la liste ordonnée d'activités Coros du corps de requête. Renvoie null
 * si aucune activité n'est fournie (complétion sans Coros). Lève si le format est
 * invalide (message renvoyé en 400 par l'appelant).
 */
function parseSelectedActivities(body: Record<string, unknown>): SelectedActivity[] | null {
  const validateCount = (n: number) => {
    if (n === 0) throw new Error("liste d'activités vide")
    if (n > MAX_ACTIVITIES) throw new Error(`limité à ${MAX_ACTIVITIES} activités`)
  }

  // Forme courante : [{ id, start_timestamp }]
  const raw = body.coros_activities
  if (raw != null) {
    if (!Array.isArray(raw)) throw new Error("coros_activities doit être un tableau")
    validateCount(raw.length)
    return raw.map((item) => {
      const rec = (item ?? {}) as Record<string, unknown>
      const id = rec.id
      if (typeof id !== "string" || !id) throw new Error("coros_activities : chaque activité doit avoir un id non vide")
      const ts = rec.start_timestamp
      return { id, start_timestamp: typeof ts === "number" && Number.isFinite(ts) ? ts : null }
    })
  }

  // Compat : coros_activity_ids = ["id", ...] (sans horodatage)
  const rawIds = body.coros_activity_ids
  if (rawIds != null) {
    if (!Array.isArray(rawIds)) throw new Error("coros_activity_ids doit être un tableau")
    validateCount(rawIds.length)
    if (!rawIds.every((x: unknown) => typeof x === "string" && x.length > 0)) {
      throw new Error("coros_activity_ids doit contenir des identifiants non vides")
    }
    return (rawIds as string[]).map((id) => ({ id, start_timestamp: null }))
  }

  // Compat : coros_activity_id = "id" (une seule activité)
  if (typeof body.coros_activity_id === "string" && body.coros_activity_id) {
    return [{ id: body.coros_activity_id, start_timestamp: null }]
  }

  return null
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
  //    Formes acceptées pour les activités Coros, par ordre de priorité :
  //      - coros_activities : [{ id, start_timestamp }]  (forme courante, permet
  //        le tri chronologique côté serveur)
  //      - coros_activity_ids : ["id", ...]              (compat : sans horodatage)
  //      - coros_activity_id : "id"                       (compat : une activité)
  //    Aucune des trois = complétion sans Coros (renfo ou course non liée).
  let sessionId: string
  let selected: SelectedActivity[] | null
  let feedback: Feedback | null
  try {
    const body = await req.json()
    sessionId = body.session_id
    feedback = parseFeedback(body.feedback)
    if (!sessionId) throw new Error("session_id requis")
    selected = parseSelectedActivities(body)
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // Champs de ressenti persistés tels quels (uniquement si un ressenti est fourni).
  const feedbackFields = feedback
    ? { rpe: feedback.rpe, pain_areas: feedback.pain_areas, feedback_note: feedback.feedback_note }
    : {}

  // 3. Séance + steps ordonnés
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, type, title, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()
  if (sessionErr || !session) return json(404, { error: "Séance introuvable" })
  if (session.status === "done") return json(409, { error: "Séance déjà complétée" })

  // 4. Cas sans Coros (renfo ou course non liée) : pas de laps à comparer.
  //    On persiste le ressenti et, s'il est présent, un conseil fondé dessus.
  if (!selected) {
    return await manualComplete(supabaseAdmin, sessionId, session.type, feedback, feedbackFields)
  }

  // 4b. Ordre chronologique garanti AVANT toute concaténation : on trie les
  //     activités par start_timestamp croissant. Une seule activité : rien à
  //     trier. Plusieurs sans horodatage : on refuse plutôt que de deviner.
  if (selected.length > 1) {
    if (!selected.every((a) => a.start_timestamp != null)) {
      return json(400, {
        error: "Horodatages manquants",
        detail: "Plusieurs activités sélectionnées sans start_timestamp : impossible de garantir l'ordre chronologique.",
      })
    }
    selected = [...selected].sort((a, b) => (a.start_timestamp as number) - (b.start_timestamp as number))
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

  // 7. Un appel MCP (queryActivityLapData) PAR activité, en SÉQUENTIEL pour rester
  //    sous la limite CPU Supabase, dans l'ordre chronologique déjà établi. Les
  //    laps bruts sont parsés en code (le modèle n'est jamais la source des
  //    valeurs numériques). Si une seule activité échoue, on n'écrit RIEN : pas de
  //    complétion partielle.
  const fetched: Array<{ id: string; laps: Lap[]; kmLaps: Lap[] | null }> = []
  for (const activity of selected) {
    const lapsResult = await fetchLaps(corosToken, activity.id, steps.length)
    if ("failure" in lapsResult) {
      // Données inexploitables : la séance reste "planned", on nomme l'activité fautive.
      return json(422, { error: "Données Coros inexploitables", detail: `Activité ${activity.id} : ${lapsResult.failure}` })
    }
    fetched.push({ id: activity.id, ...lapsResult })
  }

  const orderedIds = fetched.map((f) => f.id)
  // Concaténation des laps bout à bout dans l'ordre chronologique.
  const laps = fetched.flatMap((f) => f.laps)

  // 8. Matching + comparaison (100% en code)
  const { actualLaps, comparisons } = matchStepsToLaps(steps, laps)

  // Laps auto-km : même forme que actual_laps (lap_index, avg_pace_sec, avg_hr…)
  // mais sans rattachement à un step. Purement visuel côté client.
  // Avec PLUSIEURS activités on écrit null : les groupes auto-kilomètre repartent
  // de zéro à chaque activité, leur concaténation produirait des splits faux.
  const single = fetched.length === 1 ? fetched[0] : null
  const kmLaps = single?.kmLaps
    ? single.kmLaps.map((l, i) => ({ lap_index: i, step_index: null, ...l }))
    : null

  // 9. Analyse IA (mode simple, pas de MCP). L'échec ne bloque pas la complétion.
  const { verdict, advice } = await analyze(
    session.type,
    session.title,
    steps,
    comparisons,
    single?.kmLaps ?? null,
    feedback,
    fetched.length,
  )

  const analysis = { verdict, advice, comparisons }

  // 10. Mise à jour de la séance. On persiste la liste ordonnée et, pour la compat,
  //     coros_activity_id = premier identifiant.
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("training_sessions")
    .update({
      coros_activity_id: orderedIds[0],
      coros_activity_ids: orderedIds,
      actual_laps: actualLaps,
      km_laps: kmLaps,
      analysis,
      status: "done",
      completed_at: new Date().toISOString(),
      ...feedbackFields,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("*")
    .single()
  if (updateErr) return json(500, { error: "Mise à jour impossible", detail: updateErr.message })

  return json(200, { session: updated })
}

async function manualComplete(
  supabaseAdmin: SupabaseClient,
  sessionId: string,
  type: string,
  feedback: Feedback | null,
  feedbackFields: Record<string, unknown>,
): Promise<Response> {
  // Sans laps, il n'y a pas de comparaison prévu/réalisé : le conseil se fonde
  // uniquement sur le ressenti quand il est présent (verdict laissé à null).
  let analysis: { verdict: null; advice: string } | undefined
  if (feedback) {
    const advice = await adviceFromFeedback(type, feedback)
    if (advice) analysis = { verdict: null, advice }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("training_sessions")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      ...(analysis ? { analysis } : {}),
      ...feedbackFields,
    })
    .eq("id", sessionId)
    .select("*")
    .single()
  if (error) return json(500, { error: "Mise à jour impossible", detail: error.message })
  return json(200, { session: updated })
}

/** Conseil (Haiku) fondé uniquement sur le ressenti, pour une séance sans laps. */
async function adviceFromFeedback(type: string, feedback: Feedback): Promise<string | null> {
  const system =
    "Tu es un coach running. À partir du seul ressenti de l'athlète sur une séance qu'il vient de faire, " +
    "tu donnes un conseil court et concret (1-2 phrases). Signale toute douleur récurrente ou un RPE élevé " +
    "comme un signe de fatigue à surveiller. N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–) : " +
    "utilise \" : \", \" · \", une virgule ou reformule. Réponds UNIQUEMENT en JSON, commence par { et termine par }, " +
    'format : {"advice":"1-2 phrases en français"}'

  const userPrompt = [`Séance de type ${type}, réalisée.`, feedbackPromptBlock(feedback).trim()].join("\n")

  try {
    const raw = await anthropicSimple({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: userPrompt }],
    })
    const obj = JSON.parse(extractJson(raw))
    return typeof obj.advice === "string" && obj.advice.trim() ? obj.advice.trim() : null
  } catch (err) {
    console.error("[complete-session] advice ressenti échoué:", err instanceof Error ? err.message : err)
    return null
  }
}

/** Bornes plausibles d'une allure de course, en s/km (2:00 à 15:00 par km). */
const PACE_MIN_SEC = 120
const PACE_MAX_SEC = 900

type LapsResult =
  | { laps: Lap[]; kmLaps: Lap[] | null }
  | { failure: string }

/**
 * Récupère les laps via le connecteur MCP (queryActivityLapData) puis les parse
 * en code déterministe. Le LLM n'est qu'un déclencheur d'appel d'outil : sa
 * réponse texte est ignorée, seul le bloc mcp_tool_result est exploité.
 */
async function fetchLaps(corosToken: string, labelId: string, stepCount: number): Promise<LapsResult> {
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

  const lapGroups = (parsed as Record<string, unknown> | null)?.lapGroups
  if (!Array.isArray(lapGroups)) {
    return { failure: "Schéma Coros inattendu (lapGroups absent)" }
  }

  const group = pickLapGroup(lapGroups, stepCount)
  if (!group) {
    return { failure: "Aucun lap trouvé dans la réponse Coros" }
  }

  const rawLaps = [...group]
    .filter((l): l is Record<string, unknown> => l !== null && typeof l === "object" && !Array.isArray(l))
    .sort((a, b) => lapIndexOf(a) - lapIndexOf(b))

  const laps = rawLaps.map(mapLap)
  if (laps.every((l) => l.avg_pace_sec == null)) {
    return { failure: "Aucune allure exploitable dans les laps Coros" }
  }

  // Groupe auto-kilomètre (lapDistance=100000 = 1 km) : conservé pour la vue
  // "par km" du graphe. Ignoré s'il est absent OU identique au groupe matché.
  const kmGroup = pickKmGroup(lapGroups)
  let kmLaps: Lap[] | null = null
  if (kmGroup && kmGroup !== group) {
    const mapped = kmGroup
      .filter((l): l is Record<string, unknown> => l !== null && typeof l === "object" && !Array.isArray(l))
      .sort((a, b) => lapIndexOf(a) - lapIndexOf(b))
      .map(mapLap)
    if (mapped.length > 0) kmLaps = mapped
  }
  return { laps, kmLaps }
}

/** Groupe auto-kilomètre Coros : lapDistance en centièmes de mètre = 100000 (1 km). */
function pickKmGroup(lapGroups: unknown[]): unknown[] | null {
  for (const g of lapGroups) {
    const rec = g as Record<string, unknown> | null
    const laps = rec?.laps
    if (rec?.lapDistance === 100000 && Array.isArray(laps) && laps.length > 0) return laps
  }
  return null
}

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const lapIndexOf = (lap: Record<string, unknown>): number =>
  isFiniteNum(lap.lapIndex) ? lap.lapIndex : Number.MAX_SAFE_INTEGER

/**
 * Choisit le groupe de laps parmi lapGroups[].laps. Un seul groupe non vide : on
 * le prend. Plusieurs : on prend celui dont le nombre de laps est le plus proche
 * de stepCount (départage par le premier), et on logge la liste des groupes.
 * Le groupe de type -1 (activité entière résumée en un seul lap) est toujours
 * écarté : il ne peut jamais être le bon découpage.
 */
function pickLapGroup(lapGroups: unknown[], stepCount: number): unknown[] | null {
  const groups = lapGroups
    .map((g) => {
      const laps = (g as Record<string, unknown> | null)?.laps
      return {
        laps: Array.isArray(laps) ? laps : [],
        type: (g as Record<string, unknown> | null)?.type,
        lapDistance: (g as Record<string, unknown> | null)?.lapDistance,
      }
    })
    .filter((g) => g.laps.length > 0 && g.type !== -1)

  if (groups.length === 0) return null
  if (groups.length === 1) return groups[0].laps

  console.warn(
    "[complete-session] plusieurs groupes de laps, sélection sur proximité avec " +
      `${stepCount} steps :`,
    JSON.stringify(groups.map((g) => ({ type: g.type, lapDistance: g.lapDistance, laps: g.laps.length }))),
  )

  let best = groups[0]
  for (const g of groups) {
    if (Math.abs(g.laps.length - stepCount) < Math.abs(best.laps.length - stepCount)) best = g
  }
  return best.laps
}

/**
 * Mappe un lap brut Coros (schéma queryActivityLapData) vers Lap :
 * - distance en centimètres → mètres (distance / 100)
 * - time en secondes (décimal) → durée arrondie
 * - avgHr FC moyenne
 * L'allure est TOUJOURS recalculée en code (duration_sec / distance_km) : les
 * champs avgPace / avgSpeedV2 / adjustedPace fournis par Coros ne sont JAMAIS lus.
 */
function mapLap(lap: Record<string, unknown>): Lap {
  const distance_m = isFiniteNum(lap.distance) && lap.distance > 0 ? lap.distance / 100 : null
  const duration_sec = isFiniteNum(lap.time) && lap.time > 0 ? Math.round(lap.time) : null
  const avg_hr = isFiniteNum(lap.avgHr) && lap.avgHr > 0 ? lap.avgHr : null

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

/** Allure de repli quand un step sans cible doit tout de même être estimé (miroir front). */
const FALLBACK_PACE_SEC = 360

/** Distance estimée d'un step en mètres (version minimale du helper front). */
function estimateStepMeters(step: Step): number | null {
  if (step.distance_m != null) return step.distance_m
  if (step.duration_sec != null) {
    return Math.round((step.duration_sec / (step.target_pace_sec ?? FALLBACK_PACE_SEC)) * 1000)
  }
  return null
}

/**
 * Construit les lignes "Splits par km" pour l'analyse. Chaque km est rattaché au
 * step qui le couvre (distances cumulées, même logique que le front). Retourne []
 * si kmLaps est absent ou vide.
 */
function kmSplitLines(steps: Step[], kmLaps: Lap[] | null): string[] {
  if (!kmLaps || kmLaps.length === 0) return []

  // Distance cumulée (m) en fin de chaque step ; step couvrant le km = celui qui
  // contient son milieu, sinon on étend le dernier step connu.
  const stepEnds = steps.reduce<number[]>((arr, s) => {
    arr.push((arr.length ? arr[arr.length - 1] : 0) + (estimateStepMeters(s) ?? 0))
    return arr
  }, [])
  const stepForKm = (k: number): Step | undefined => {
    const d = (k - 0.5) * 1000
    for (let i = 0; i < stepEnds.length; i++) if (d <= stepEnds[i]) return steps[i]
    return steps[steps.length - 1]
  }

  return kmLaps.map((l, i) => {
    const km = i + 1
    const step = stepForKm(km)
    const target = step?.target_pace_sec ?? null
    const pace = l.avg_pace_sec
    if (target != null && pace != null) {
      const tol = step?.pace_tolerance_sec ?? 5
      const delta = Math.round(pace - target)
      const sign = delta > 0 ? "+" : ""
      return `km ${km} : réalisé ${paceStr(pace)}, cible ${paceStr(target)} ± ${tol}s (delta ${sign}${delta}s)`
    }
    return `km ${km} : réalisé ${paceStr(pace)} (libre)`
  })
}

/** Analyse IA (Haiku, mode simple). Renvoie { verdict: null, advice: null } si échec définitif. */
async function analyze(
  type: string,
  title: string,
  steps: Step[],
  comparisons: Comparison[],
  kmLaps: Lap[] | null,
  feedback: Feedback | null,
  activityCount: number,
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
    "et un conseil concret. Le verdict se fonde UNIQUEMENT sur la comparaison des steps (lignes 'Steps comparés'). " +
    "Les splits par km servent seulement à enrichir le conseil (gestion d'allure, régularité, négatif/positif split). " +
    "Ne dégrade pas le verdict à cause des splits ni du ressenti. " +
    "Le CONSEIL (advice), lui, doit tenir compte du ressenti de l'athlète quand il est fourni : " +
    "un RPE >= 8 sur une séance facile pourtant réussie doit être signalé dans le conseil comme un signe de " +
    "fatigue, et toute douleur mentionnée doit être prise en compte. " +
    "N'utilise JAMAIS de tiret cadratin (—) ni demi-cadratin (–) dans le conseil : " +
    "utilise \" : \", \" · \", une virgule ou reformule. Réponds UNIQUEMENT en JSON, commence par { et termine par }, format : " +
    '{"verdict":"reussie|partiellement|a_retravailler","advice":"2-3 phrases concrètes en français"}'

  const kmLines = kmSplitLines(steps, kmLaps)

  // Plusieurs activités Coros concaténées : une coupure d'allure entre deux
  // activités est normale (la montre a été relancée), le conseil ne doit pas s'en
  // étonner ni la traiter comme une baisse de régime.
  const multiActivityNote = activityCount > 1
    ? `Note : cette séance concatène ${activityCount} activités Coros distinctes ` +
      "(la montre a été relancée en cours de sortie). Une coupure d'allure à la " +
      "jonction entre deux activités est attendue, ne la signale pas comme un problème."
    : ""

  const userPrompt = [
    `Séance : ${title} (type ${type})`,
    `Steps comparés : ${comparisons.length} — dans la cible : ${nOk}, en écart : ${nEcart}.`,
    ...(multiActivityNote ? [multiActivityNote] : []),
    "Détail :",
    ...lines,
    ...(kmLines.length ? ["", "Splits par km :", ...kmLines] : []),
    feedbackPromptBlock(feedback),
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
