import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const TZ = "Europe/Paris"

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

function toParisDateTime(ts: number): { date: string; startTime: string } {
  const d = new Date(ts)
  const dateParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d)
  const timeParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)
  const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? ""
  const date = `${get(dateParts, "year")}-${get(dateParts, "month")}-${get(dateParts, "day")}`
  const startTime = `${get(timeParts, "hour")}:${get(timeParts, "minute")}`
  return { date, startTime }
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

  let body: { date?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS })
  }

  const targetDate = body.date ?? new Date().toISOString().slice(0, 10)
  const sessionType = body.type ?? ""

  const target = new Date(targetDate + "T12:00:00Z")
  const dayBefore = new Date(target)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const dayAfter = new Date(target)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const startDate = fmtDate(dayBefore)
  const endDate = fmtDate(dayAfter)

  const systemPrompt =
    "Tu es un assistant spécialisé en données sportives Coros. " +
    "Appelle querySportRecords avec sportTypeCodes=[100], timezone=Europe/Paris, et les dates fournies. " +
    'Retourne UNIQUEMENT ce JSON sans markdown ni texte : {"matches":[{"labelId":"","startTimestamp":0,"distance":"X.XX km","duration":"XhXXmin","avgPace":"X:XX /km","avgHr":"XXX bpm"}]} ' +
    "startTimestamp doit être le timestamp Unix en MILLISECONDES du début de l'activité, tel que fourni brut par l'API Coros (sans conversion). " +
    "Trie les résultats par proximité à la date cible. Si aucune séance, retourne {\"matches\":[]}. Commence par { et termine par }."

  const userMessage =
    `Appelle querySportRecords avec startDate=${startDate}, endDate=${endDate}, limit=10, sportTypeCodes=[100], timezone=Europe/Paris.\n` +
    `Date cible : ${targetDate} (type prévu : ${sessionType || "course à pied"}).\n` +
    `Retourne le JSON avec startTimestamp brut (Unix ms) pour chaque séance.`

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
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [{
        type: "mcp_toolset",
        mcp_server_name: "coros",
        default_config: { enabled: false },
        configs: { querySportRecords: { enabled: true } },
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
    console.error("[coros-match] Anthropic error:", anthropicRes.status, errText)
    return Response.json({ matches: [] }, { headers: CORS })
  }

  const anthropicData = await anthropicRes.json()
  const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
  const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

  if (!rawText) {
    console.error("[coros-match] empty response:", JSON.stringify(anthropicData))
    return Response.json({ matches: [] }, { headers: CORS })
  }

  let result: { matches?: Array<Record<string, unknown>> }
  try {
    result = JSON.parse(extractJson(rawText))
  } catch (err) {
    console.error("[coros-match] JSON parse error:", err, "raw:", rawText.slice(0, 300))
    return Response.json({ matches: [] }, { headers: CORS })
  }

  const matches = (result.matches ?? []).map((m) => {
    const ts = typeof m.startTimestamp === "number" ? m.startTimestamp : null
    if (ts) {
      const { date, startTime } = toParisDateTime(ts)
      return { ...m, date, startTime, startTimestamp: undefined }
    }
    return { ...m, date: targetDate, startTime: null }
  })

  return Response.json({ matches }, { headers: CORS })
})
