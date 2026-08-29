import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import { callCorosTool } from "../_shared/coros-mcp.ts"
import { type FitnessOverview, parseFitnessOverview } from "../_shared/coros-parse.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // Appel MCP direct : queryFitnessAssessmentOverview ne prend aucun parametre.
  let fitness: FitnessOverview
  let text = ""
  try {
    text = await callCorosTool(corosToken, "queryFitnessAssessmentOverview", {})
    fitness = parseFitnessOverview(text)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    // Le texte brut est la seule trace exploitable si Coros change son format.
    console.error("[coros-fitness] échec:", detail, "raw:", text.slice(0, 500))
    return Response.json(
      { error: "Données de forme Coros indisponibles", detail },
      { status: 502, headers: CORS },
    )
  }

  const result = {
    vo2max: fitness.vo2max,
    threshold_pace: fitness.threshold_pace,
    running_level: fitness.running_level,
    vma_derived: parseFloat((fitness.vo2max / 3.5).toFixed(1)),
    predictions: fitness.predictions,
    source: "coros",
    captured_at: new Date().toISOString(),
  }

  return Response.json(result, { headers: CORS })
})
