import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function buildSystemPrompt(hasFitnessSnapshot: boolean): string {
  return `Tu es un coach running expert spécialisé en plans d'entraînement personnalisés.
Tu as accès aux données d'entraînement Coros de l'athlète via les outils MCP.

Processus obligatoire avant de générer le plan :
${hasFitnessSnapshot
    ? "1. Les données de forme sont déjà fournies dans le prompt — n'appelle PAS queryFitnessAssessmentOverview."
    : "1. Appelle queryFitnessAssessmentOverview pour obtenir le snapshot de forme (VO2max, seuil, VMA dérivée, prédictions)."
  }
2. Appelle querySportRecords avec sportTypeCodes=[100], limit=20 pour voir l'historique des 6 dernières semaines.

Règles de génération du plan :
- Calibre toutes les allures depuis l'allure seuil Coros : facile = seuil +45-60s/km, tempo = seuil, fractionné = allure 5k-10k
- VMA dérivée : VO2max / 3.5
- Structure en 3 blocs : construction (~40% des semaines), intensification (~40%), affûtage (~20%)
- Chaque semaine contient exactement 4 séances : Zone A (facile), Zone B (qualité), Zone C (sortie longue), Renfo
- Zone A : lundi ou mardi — course facile
- Zone B : mercredi, jeudi ou vendredi — fractionné ou tempo selon le bloc
- Zone C : samedi ou dimanche — sortie longue progressive
- Renfo : tapis de sol uniquement, orienté course à pied (gainage, fessiers, ischios, proprioception), avec exercices détaillés + séries + durée + temps de repos
- Progression logique entre semaines, jamais deux séances dures consécutives
- Ne pas copier les séances Coros passées — s'en inspirer pour calibrer l'intensité
- Sois concis dans tous les champs "notes" : 1 phrase max, pas de répétition

Réponds UNIQUEMENT avec le JSON, sans aucun texte avant ni après, sans bloc markdown \`\`\`. Commence directement par { et termine par }.`
}

interface FitnessSnapshot {
  vo2max: number
  threshold_pace: string
  running_level: string
  vma_derived?: number
  predictions: { five_k?: string; ten_k?: string; half?: string; marathon?: string }
  source: string
  captured_at: string
}

interface PlanContext {
  raceName?: string
  raceType?: string
  raceDate?: string
  startDate?: string
  trailDistance?: string
  trailElevation?: number
  targetTime?: string
  targetPalier?: string
  vmaSource?: string
  vmaManual?: string
  fitnessSnapshot?: FitnessSnapshot
  previousRaces?: Array<{ label: string; time: string }>
  notes?: string
}

function buildUserPrompt(context: PlanContext): string {
  const startDate = context.startDate ?? new Date().toISOString().split("T")[0]
  const weeksUntil = context.raceDate && startDate
    ? Math.round((new Date(context.raceDate).getTime() - new Date(startDate).getTime()) / (7 * 24 * 3600 * 1000))
    : null

  const raceDistance = context.raceType === "trail"
    ? `Trail ${context.trailDistance ?? ""}${context.trailElevation ? ` D+${context.trailElevation}m` : ""}`
    : context.raceType ?? "Non précisé"

  const lines = [
    "Génère un plan d'entraînement complet avec ces informations :",
    "",
    `Course : ${context.raceName ?? "Non précisé"}`,
    `Distance : ${raceDistance}`,
    `Date de course : ${context.raceDate ?? "Non précisé"}`,
    `Date de début : ${startDate}`,
    `Nombre de semaines : ${weeksUntil ?? "À calculer depuis la date"}`,
    `Objectif : ${context.targetTime ?? "Non précisé"}`,
    `Source VMA : ${context.vmaSource ?? "coros"}${context.vmaManual ? ` — VMA ${context.vmaManual} km/h` : ""}`,
  ]

  if (context.fitnessSnapshot) {
    const s = context.fitnessSnapshot
    const vma = s.vma_derived ?? (s.vo2max ? parseFloat((s.vo2max / 3.5).toFixed(1)) : null)
    lines.push(
      "",
      "Snapshot de forme Coros (ne pas rappeler queryFitnessAssessmentOverview) :",
      `  VO2max : ${s.vo2max}`,
      `  Seuil : ${s.threshold_pace}`,
      `  Niveau : ${s.running_level}`,
      ...(vma ? [`  VMA dérivée : ${vma} km/h`] : []),
      `  Prédictions : 5k ${s.predictions?.five_k ?? "—"}, 10k ${s.predictions?.ten_k ?? "—"}, semi ${s.predictions?.half ?? "—"}, marathon ${s.predictions?.marathon ?? "—"}`,
    )
  }

  if (context.previousRaces?.length) {
    lines.push(`Courses précédentes : ${context.previousRaces.map((r) => `${r.label} (${r.time})`).join(", ")}`)
  }

  if (context.notes) lines.push(`Remarques de l'athlète : ${context.notes}`)

  lines.push(
    "",
    "Structure JSON attendue (UNIQUEMENT ce JSON, rien d'autre) :",
    JSON.stringify({
      fitness_snapshot: {
        vo2max: 52.3,
        running_level: "intermediate",
        threshold_pace: "5:05/km",
        vma_derived: 14.9,
        predictions: { "5k": "23:10", "10k": "48:00", semi: "1:44:00" },
        source: "coros",
        captured_at: new Date().toISOString(),
      },
      plan: {
        summary: "résumé du plan en 2-3 phrases",
        blocks: ["construction", "intensification", "affutage"],
      },
      sessions: [
        {
          week_number: 1,
          block: "construction",
          zone: "A",
          type: "facile",
          title: "Sortie facile",
          details: { duration: "45min", pace: "6:00/km", notes: "..." },
        },
        {
          week_number: 1,
          block: "construction",
          zone: "B",
          type: "fractionné",
          title: "Fractionné court",
          details: { warmup: "15min", reps: 6, distance: "400m", pace: "4:00/km", recovery: "90s", cooldown: "10min" },
        },
        {
          week_number: 1,
          block: "construction",
          zone: "C",
          type: "sortie_longue",
          title: "Sortie longue",
          details: { duration: "1h15", pace: "6:10/km", notes: "..." },
        },
        {
          week_number: 1,
          block: "construction",
          zone: "renfo",
          type: "renfo",
          title: "Renforcement musculaire",
          details: {
            exercises: [{ name: "Gainage planche", sets: 3, duration: "45s", rest: "30s" }],
          },
        },
      ],
    }, null, 2),
  )

  return lines.join("\n")
}

function extractJson(rawText: string): string {
  const mdBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdBlock) return mdBlock[1].trim()
  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  return start !== -1 && end > start ? rawText.slice(start, end + 1) : rawText.trim()
}

async function generatePlanInBackground(
  supabaseAdmin: ReturnType<typeof createClient>,
  planId: string,
  userId: string,
  corosToken: string,
  context: PlanContext,
) {
  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY manquante")

    const hasFitnessSnapshot = !!(
      context.fitnessSnapshot ||
      (context.vmaSource === "manual" && context.vmaManual)
    )

    const mcpConfigs: Record<string, { enabled: boolean }> = {
      querySportRecords: { enabled: true },
      queryActivityLapData: { enabled: true },
    }
    if (!hasFitnessSnapshot) mcpConfigs.queryFitnessAssessmentOverview = { enabled: true }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-11-20",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: buildSystemPrompt(hasFitnessSnapshot),
        messages: [{ role: "user", content: buildUserPrompt(context) }],
        tools: [{
          type: "mcp_toolset",
          mcp_server_name: "coros",
          default_config: { enabled: false },
          configs: mcpConfigs,
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
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`)
    }

    const anthropicData = await anthropicRes.json()
    const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
    const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

    if (!rawText) {
      console.error("[generate-plan] Réponse Anthropic vide:", JSON.stringify(anthropicData))
      throw new Error("Réponse Anthropic vide ou inattendue")
    }

    const cleaned = extractJson(rawText)
    let planData: { fitness_snapshot?: unknown; plan?: unknown; sessions?: unknown[] }
    try {
      planData = JSON.parse(cleaned)
    } catch (err) {
      console.error("[generate-plan] JSON parse error:", err)
      console.error("[generate-plan] Raw:", rawText.slice(0, 500))
      throw new Error(`JSON invalide: ${err instanceof Error ? err.message : String(err)}`)
    }

    const sessions = planData.sessions ?? []
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new Error("Aucune séance dans le plan généré")
    }

    // Insérer les séances
    const rows = (sessions as Record<string, unknown>[]).map((s) => ({
      plan_id: planId,
      user_id: userId,
      week_number: s.week_number,
      block: s.block,
      zone: s.zone,
      type: s.type,
      title: s.title,
      details: s.details,
      status: "à_venir",
    }))

    const { error: sessionsError } = await supabaseAdmin.from("training_sessions").insert(rows)
    if (sessionsError) throw new Error(`Insertion séances: ${sessionsError.message}`)

    // Marquer le plan comme prêt
    const { error: updateError } = await supabaseAdmin.from("training_plans").update({
      generation_status: "ready",
      fitness_snapshot: context.fitnessSnapshot ?? planData.fitness_snapshot ?? null,
    }).eq("id", planId)
    if (updateError) throw new Error(`Update plan: ${updateError.message}`)

    console.log(`[generate-plan] Plan ${planId} généré : ${sessions.length} séances`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[generate-plan] Background error:", message)
    await supabaseAdmin.from("training_plans").update({
      generation_status: "error",
      generation_error: message,
    }).eq("id", planId)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[generate-plan] Uncaught exception:", message)
    return Response.json({ error: "Internal server error", detail: message }, { status: 500, headers: CORS })
  }
})

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  // 1. Auth Supabase
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

  // 2. Vérifier doublon en cours
  const { data: existing } = await supabaseAdmin
    .from("training_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("generation_status", "generating")
    .maybeSingle()
  if (existing) {
    return Response.json({ planId: existing.id, status: "generating" }, { headers: CORS })
  }

  // 3. Contexte du wizard
  let context: PlanContext = {}
  try {
    const body = await req.json()
    if (body?.context && typeof body.context === "object") context = body.context
  } catch { /* body absent — contexte vide */ }

  // 4. Archiver plans actifs + créer nouveau plan
  await supabaseAdmin.from("training_plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active")

  const raceDistance = context.raceType === "trail"
    ? (context.trailDistance ?? "Trail")
    : (context.raceType ?? null)

  const planRow = {
    user_id: user.id,
    race_name: context.raceName ?? null,
    race_date: context.raceDate || null,
    race_distance: raceDistance,
    race_elevation: context.raceType === "trail" ? (context.trailElevation ?? null) : null,
    target_time: context.targetTime ?? null,
    vma_source: context.vmaSource ?? "coros",
    previous_races: context.previousRaces ?? [],
    notes: context.notes ?? null,
    start_date: context.startDate ?? new Date().toISOString().split("T")[0],
    status: "active",
    generation_status: "generating",
  }
  console.log("[generate-plan] inserting plan:", JSON.stringify(planRow))

  const { data: newPlan, error: insertError } = await supabaseAdmin
    .from("training_plans")
    .insert(planRow)
    .select("id")
    .single()

  if (insertError || !newPlan) {
    console.error("[generate-plan] insert plan error:", JSON.stringify(insertError))
    return Response.json({ error: "Impossible de créer le plan", detail: insertError?.message }, { status: 500, headers: CORS })
  }

  // 5. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await supabaseAdmin.from("training_plans").update({
      generation_status: "error",
      generation_error: "Coros authentication required",
    }).eq("id", newPlan.id)
    return Response.json({ error: "Coros authentication required", detail }, { status: 503, headers: CORS })
  }

  // 6. Lancer en arrière-plan et répondre immédiatement
  EdgeRuntime.waitUntil(generatePlanInBackground(supabaseAdmin, newPlan.id, user.id, corosToken, context))

  console.log(`[generate-plan] Plan ${newPlan.id} créé, génération lancée en arrière-plan`)
  return Response.json({ planId: newPlan.id, status: "generating" }, { headers: CORS })
}
