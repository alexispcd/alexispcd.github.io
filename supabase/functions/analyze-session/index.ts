import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface AnalysisResult {
  verdict: string
  summary: string
  comparison: Array<{ label: string; planned: string; actual: string; status: string }>
  advice: string
}

function extractJson(raw: string): string {
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) return block[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  return start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim()
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[analyze-session] Uncaught:", message)
    return Response.json({ error: "Internal server error", detail: message }, { status: 500, headers: CORS })
  }
})

async function handleRequest(req: Request): Promise<Response> {
  // 1. Auth
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return Response.json({ error: "Missing authorization" }, { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 2. Body
  let sessionId: string
  try {
    const body = await req.json()
    sessionId = body.sessionId
    if (!sessionId) throw new Error("sessionId requis")
  } catch (err) {
    return Response.json({ error: "Body invalide", detail: String(err) }, { status: 400, headers: CORS })
  }

  // 3. Récupérer la séance (vérifie user_id pour sécurité)
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, plan_id, type, title, details, coros_label_id, status, completed_at, scheduled_date")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: "Séance introuvable" }, { status: 404, headers: CORS })
  }
  if (!session.coros_label_id) {
    return Response.json({ error: "Aucune séance Coros liée à cette séance" }, { status: 422, headers: CORS })
  }

  // 4. Récupérer le snapshot fitness du plan (pour contexte allures)
  const { data: plan } = await supabaseAdmin
    .from("training_plans")
    .select("fitness_snapshot")
    .eq("id", session.plan_id)
    .single()

  const fitnessCtx = plan?.fitness_snapshot
    ? [
        plan.fitness_snapshot.threshold_pace && `Allure seuil : ${plan.fitness_snapshot.threshold_pace}`,
        plan.fitness_snapshot.vma_derived && `VMA dérivée : ${plan.fitness_snapshot.vma_derived} km/h`,
        plan.fitness_snapshot.vo2max && `VO2max : ${plan.fitness_snapshot.vo2max}`,
      ].filter(Boolean).join(", ")
    : null

  // 5. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[analyze-session] Coros token error:", detail)
    return Response.json({ error: "Coros authentication required", detail }, { status: 503, headers: CORS })
  }

  // 6. Construire la plage de dates autour de la date de complétion
  const refDate = session.completed_at
    ? new Date(session.completed_at)
    : session.scheduled_date
    ? new Date(session.scheduled_date + "T12:00:00Z")
    : new Date()

  const dayBefore = new Date(refDate)
  dayBefore.setDate(dayBefore.getDate() - 2)
  const dayAfter = new Date(refDate)
  dayAfter.setDate(dayAfter.getDate() + 1)
  const startDate = fmtDate(dayBefore)
  const endDate = fmtDate(dayAfter)

  const isFraction = session.type === "fractionné"

  const promptLines = [
    "Tu es un coach running. Compare la séance PRÉVUE avec la séance RÉALISÉE sur Coros.",
    "",
    "SÉANCE PRÉVUE :",
    `Type : ${session.type} — ${session.title}`,
    `Détails : ${JSON.stringify(session.details, null, 2)}`,
    fitnessCtx ? `Contexte physiologique : ${fitnessCtx}` : null,
    "",
    `DONNÉES COROS (labelId cible : "${session.coros_label_id}") :`,
    `1. Appelle querySportRecords avec startDate=${startDate}, endDate=${endDate}, limit=20, sportTypeCodes=[100], timezone=Europe/Paris.`,
    `   Trouve la séance dont le labelId correspond à "${session.coros_label_id}".`,
    `   Extrais : distance totale, durée, allure moyenne, FC moyenne.`,
    isFraction
      ? `2. Appelle queryActivityLapData avec labelId="${session.coros_label_id}" et sportType=100 pour obtenir le détail des intervalles réels (allure et FC par répétition).`
      : null,
    "",
    "Retourne UNIQUEMENT ce JSON, commence par { et termine par } :",
    JSON.stringify({
      verdict: "réussie | partiellement | à_retravailler",
      summary: "2-3 phrases sur le déroulement global de la séance",
      comparison: [
        { label: "Nom de la métrique", planned: "valeur prévue", actual: "valeur réalisée", status: "ok | proche | écart" },
      ],
      advice: "Conseil court (1-2 phrases) pour la prochaine séance de ce type",
    }, null, 2),
    "",
    'Critères status : "ok" = dans la cible ou mieux, "proche" = écart < 8% ou < 15s/km, "écart" = écart significatif.',
    'Si une donnée est absente dans Coros, mettre actual="non disponible" et status="ok".',
    "N'invente jamais de données absentes.",
  ].filter((l) => l !== null).join("\n")

  // 7. Appel Anthropic avec MCP Coros
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!anthropicKey) return Response.json({ error: "Server configuration error" }, { status: 500, headers: CORS })

  console.log("[analyze-session] appel Anthropic pour séance", sessionId)
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-11-20",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: promptLines }],
      tools: [{
        type: "mcp_toolset",
        mcp_server_name: "coros",
        default_config: { enabled: false },
        configs: {
          querySportRecords: { enabled: true },
          queryActivityLapData: { enabled: true },
        },
      }],
      mcp_servers: [{
        type: "url",
        url: "https://mcpeu.coros.com/mcp",
        name: "coros",
        authorization_token: corosToken,
      }],
    }),
  })

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "")
    console.error("[analyze-session] Anthropic error:", anthropicRes.status, errText)
    return Response.json({ error: "Anthropic API error", detail: errText }, { status: 502, headers: CORS })
  }

  const anthropicData = await anthropicRes.json()
  const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
  const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

  if (!rawText) {
    console.error("[analyze-session] Réponse Anthropic vide:", JSON.stringify(anthropicData))
    return Response.json({ error: "Réponse Anthropic vide ou inattendue" }, { status: 502, headers: CORS })
  }

  // 8. Extraire le JSON
  let analysis: AnalysisResult
  try {
    analysis = JSON.parse(extractJson(rawText)) as AnalysisResult
  } catch (err) {
    console.error("[analyze-session] JSON parse error:", err, "raw:", rawText.slice(0, 400))
    return Response.json({ error: "JSON invalide dans la réponse IA", detail: String(err) }, { status: 502, headers: CORS })
  }

  // 9. Sauvegarder l'analyse en base
  const { error: updateErr } = await supabaseAdmin
    .from("training_sessions")
    .update({ coros_analysis: analysis })
    .eq("id", sessionId)

  if (updateErr) {
    console.error("[analyze-session] save error:", updateErr.message)
  }

  console.log("[analyze-session] analyse générée et sauvegardée, verdict:", analysis.verdict)
  return Response.json({ analysis }, { headers: CORS })
}
