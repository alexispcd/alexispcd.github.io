import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const DEFAULT_PROMPT =
  "Appelle querySportRecords une seule fois pour récupérer mes 5 dernières séances de course à pied (sportTypeCodes=[100], limit=5). " +
  "Pour chaque séance, donne la date, la distance, l'allure moyenne et la FC moyenne. " +
  "Ne fais pas d'appel supplémentaire par séance. " +
  "Termine par une courte synthèse (3-4 phrases) de ma forme actuelle."

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  // 1. Vérification auth Supabase
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return Response.json({ error: "Missing authorization" }, { status: 401, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
  }

  // 2. Client admin (service role) — contourne RLS pour lire coros_tokens
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 3. Token Coros valide, rafraîchi si nécessaire
  console.log("[coros-analysis] userId from JWT:", user.id)
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("Coros token error:", detail)
    return Response.json(
      { error: "Coros authentication required", detail },
      { status: 503, headers: CORS },
    )
  }

  // 4. Paramètre optionnel depuis le body
  let question = DEFAULT_PROMPT
  try {
    const body = await req.json()
    if (typeof body?.question === "string" && body.question.trim()) {
      question = body.question.trim()
    }
  } catch {
    // body absent ou invalide — on garde le prompt par défaut
  }

  // 5. Appel Anthropic avec MCP Coros
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!anthropicKey) {
    console.error("ANTHROPIC_API_KEY manquante")
    return Response.json({ error: "Server configuration error" }, { status: 500, headers: CORS })
  }

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
      max_tokens: 1500,
      messages: [{ role: "user", content: question }],
      tools: [{
        type: "mcp_toolset",
        mcp_server_name: "coros",
        default_config: { enabled: false },
        configs: {
          querySportRecords: { enabled: true },
          queryActivityLapData: { enabled: true },
          queryFitnessAssessmentOverview: { enabled: true },
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
    console.error("Anthropic API error:", anthropicRes.status, errText)
    return Response.json(
      { error: "Anthropic API error", detail: errText },
      { status: 502, headers: CORS },
    )
  }

  // 6. Extraire les blocs texte (ignorer mcp_tool_use et mcp_tool_result)
  const anthropicData = await anthropicRes.json()
  const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
  const analysis = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")

  if (!analysis) {
    console.error("Aucun bloc texte dans la réponse Anthropic:", JSON.stringify(anthropicData))
    return Response.json(
      { error: "Réponse Anthropic vide ou inattendue" },
      { status: 502, headers: CORS },
    )
  }

  // 7. Retourner l'analyse
  return Response.json({ analysis }, { headers: CORS })
})
