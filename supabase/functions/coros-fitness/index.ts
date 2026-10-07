import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { requireModule } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { errorMessage } from "../_shared/http.ts"
import { getValidCorosToken } from "../_shared/coros-token.ts"
import { callCorosTool } from "../_shared/coros-mcp.ts"
import { type FitnessOverview, parseFitnessOverview } from "../_shared/coros-parse.ts"

Deno.serve(withCors(async (req) => {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return Response.json({ error: "Missing authorization" }, { status: 401 })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  const denied = await requireModule(supabaseAdmin, user.id, "training")
  if (denied) return denied

  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    console.error("[coros-fitness] token Coros:", errorMessage(err))
    return Response.json({ error: "Coros authentication required", detail: "Reconnecte ton compte Coros dans les réglages." }, { status: 503 })
  }

  // Appel MCP direct : queryFitnessAssessmentOverview ne prend aucun parametre.
  let fitness: FitnessOverview
  let text = ""
  try {
    text = await callCorosTool(corosToken, "queryFitnessAssessmentOverview", {})
    fitness = parseFitnessOverview(text)
  } catch (err) {
    // Le texte brut est la seule trace exploitable si Coros change son format :
    // logs uniquement, il peut contenir des injections.
    console.error("[coros-fitness] échec:", errorMessage(err), "raw:", text.slice(0, 500))
    return Response.json({ error: "Données de forme Coros indisponibles" }, { status: 502 })
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

  return Response.json(result)
}))
