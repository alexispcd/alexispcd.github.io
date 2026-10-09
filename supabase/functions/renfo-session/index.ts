import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { requireModule } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { internalError } from "../_shared/http.ts"
import { availableExercises } from "../_shared/strength/catalog.ts"
import { generateSessions, loadStrengthSetup, PROFILE_MISSING } from "../_shared/strength/generate.ts"
import { buildFreeSessionPrompt, buildSystemPrompt, type PriorSession } from "../_shared/strength/prompt.ts"
import { FREE_KINDS, type SessionKind } from "../_shared/strength/rules.ts"
import { mondayOf, todayISO } from "../_shared/training/weeks.ts"

// Séance libre, synchrone : une seule séance, appel court.
const MAX_TOKENS = 4000
// Deux appels au plus (retry) sous la limite runtime de la requête.
const CALL_TIMEOUT_MS = 70_000

const json = (status: number, body: unknown) => Response.json(body, { status })

async function handleRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json(401, { error: "Missing authorization" })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })
  const denied = await requireModule(supabaseAdmin, user.id, "renfo")
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Corps JSON invalide" })
  }
  const kind = body?.kind
  if (typeof kind !== "string" || !(FREE_KINDS as string[]).includes(kind)) {
    return json(400, { error: "Type de séance invalide" })
  }
  const sessionKind = kind as SessionKind

  const setup = await loadStrengthSetup(supabaseAdmin, user.id)
  if (!setup) return json(409, PROFILE_MISSING)

  const weekStart = mondayOf(todayISO())
  const { data: weekRows, error: weekError } = await supabaseAdmin
    .from("strength_sessions")
    .select("week_index, kind, title, status, content")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .order("position")
  if (weekError) return internalError("renfo-session", weekError.message)

  const result = await generateSessions({
    system: buildSystemPrompt(availableExercises(setup.equipment, setup.bandsKg), setup.bandsKg),
    userPrompt: buildFreeSessionPrompt(sessionKind, (weekRows ?? []) as PriorSession[]),
    kinds: [sessionKind],
    setup,
    mainSlugs: null,
    maxTokens: MAX_TOKENS,
    timeoutMs: CALL_TIMEOUT_MS,
    logTag: `[renfo-session] ${user.id}`,
  })
  if (!result.ok) {
    console.error(`[renfo-session] ${user.id} séance invalide après retry :`, result.errors.slice(0, 10))
    return json(422, { error: "Séance générée invalide", details: result.errors.slice(0, 10) })
  }

  const { content } = result.sessions[0]
  const { data: session, error: insertError } = await supabaseAdmin
    .from("strength_sessions")
    .insert({
      user_id: user.id,
      cycle_id: null,
      week_index: null,
      week_start: weekStart,
      position: weekRows?.length ?? 0,
      kind: sessionKind,
      title: content.title,
      content,
    })
    .select("*")
    .single()
  if (insertError || !session) return internalError("renfo-session", insertError?.message ?? "insert sans ligne")

  return json(200, { session })
}

Deno.serve(withCors(async (req) => {
  try {
    return await handleRequest(req)
  } catch (err) {
    return internalError("renfo-session", err)
  }
}))
