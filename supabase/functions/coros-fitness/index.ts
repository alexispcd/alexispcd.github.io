import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SYSTEM_PROMPT =
  "Tu es un assistant spécialisé en données sportives. " +
  "Appelle queryFitnessAssessmentOverview puis retourne UNIQUEMENT ce JSON (sans markdown, sans texte avant ni après) : " +
  '{"vo2max":0,"threshold_pace":"","running_level":"","predictions":{"five_k":"","ten_k":"","half":"","marathon":""}} ' +
  "Remplis chaque champ depuis les données Coros. Commence directement par { et termine par }."

function extractJson(raw: string): string {
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) return block[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  return start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

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

  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return Response.json({ error: "Coros authentication required", detail }, { status: 503, headers: CORS })
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!anthropicKey) return Response.json({ error: "Server configuration error" }, { status: 500, headers: CORS })

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
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Récupère mon bilan de forme Coros." }],
      tools: [{
        type: "mcp_toolset",
        mcp_server_name: "coros",
        default_config: { enabled: false },
        configs: { queryFitnessAssessmentOverview: { enabled: true } },
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
    console.error("[coros-fitness] Anthropic error:", anthropicRes.status, errText)
    return Response.json({ error: "Anthropic API error", detail: errText }, { status: 502, headers: CORS })
  }

  const anthropicData = await anthropicRes.json()
  const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
  const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

  if (!rawText) {
    console.error("[coros-fitness] empty response:", JSON.stringify(anthropicData))
    return Response.json({ error: "Réponse Anthropic vide" }, { status: 502, headers: CORS })
  }

  let fitness: Record<string, unknown>
  try {
    fitness = JSON.parse(extractJson(rawText))
  } catch (err) {
    console.error("[coros-fitness] JSON parse error:", err, "raw:", rawText.slice(0, 300))
    return Response.json({ error: "Réponse Coros invalide", detail: rawText.slice(0, 200) }, { status: 502, headers: CORS })
  }

  const vo2max = typeof fitness.vo2max === "number" ? fitness.vo2max : parseFloat(String(fitness.vo2max))
  const result = {
    vo2max,
    threshold_pace: fitness.threshold_pace ?? "",
    running_level: fitness.running_level ?? "",
    vma_derived: parseFloat((vo2max / 3.5).toFixed(1)),
    predictions: fitness.predictions ?? {},
    source: "coros",
    captured_at: new Date().toISOString(),
  }

  return Response.json(result, { headers: CORS })
})
