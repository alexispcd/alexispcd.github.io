import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { getValidCorosToken } from "../_shared/coros-token.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function extractJson(rawText: string): string {
  const mdBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (mdBlock) return mdBlock[1].trim()
  const start = rawText.indexOf("{")
  const end = rawText.lastIndexOf("}")
  return start !== -1 && end > start ? rawText.slice(start, end + 1) : rawText.trim()
}

function buildSystemPrompt(): string {
  return `Tu es un coach running expert spécialisé en plans d'entraînement personnalisés.
Tu as accès aux données d'entraînement Coros de l'athlète via les outils MCP.

Processus obligatoire avant de générer les séances :
1. Appelle querySportRecords avec sportTypeCodes=[100], limit=20 pour voir les séances récentes réelles et recalibrer si nécessaire.

Règles de régénération du plan :
- L'athlète vient de manquer plusieurs séances : la semaine de reprise doit avoir une charge légèrement réduite (3 séances sur 4, ou intensités moindres), puis reprendre une progression normale.
- Calibre toutes les allures depuis l'allure seuil : facile = seuil +45-60s/km, tempo = seuil, fractionné = allure 5k-10k.
- Structure les semaines restantes en blocs cohérents (Construction → Intensification → Affûtage) selon la proximité de la course.
- Chaque semaine contient exactement 4 séances : Zone A (facile), Zone B (qualité), Zone C (sortie longue), Renfo.
- Zone A : lundi ou mardi — course facile.
- Zone B : mercredi, jeudi ou vendredi — fractionné ou tempo selon le bloc.
- Zone C : samedi ou dimanche — sortie longue progressive.
- Renfo : tapis de sol uniquement, orienté course à pied (gainage, fessiers, ischios, proprioception), exercices détaillés + séries + durée + repos.
- Jamais deux séances dures consécutives, progression logique semaine après semaine.
- Sois concis dans les champs "notes" : 1 phrase max.

Réponds UNIQUEMENT avec le JSON, sans aucun texte avant ni après, sans bloc markdown. Commence directement par { et termine par }.`
}

function buildUserPrompt(
  plan: Record<string, unknown>,
  currentWeek: number,
  totalWeeks: number,
  recentlySkippedCount: number,
): string {
  const snapshot = (plan.fitness_snapshot ?? {}) as Record<string, unknown>
  const preds = (snapshot.predictions ?? {}) as Record<string, string>
  const weeksToRegenerate = totalWeeks - currentWeek

  const lines = [
    `Régénère la SUITE d'un plan d'entraînement. Génère UNIQUEMENT les séances des semaines ${currentWeek + 1} à ${totalWeeks} (${weeksToRegenerate} semaine${weeksToRegenerate > 1 ? "s" : ""} restante${weeksToRegenerate > 1 ? "s" : ""}).`,
    "",
    `Course : ${plan.race_name ?? "Non précisé"}`,
    `Distance : ${plan.race_distance ?? "Non précisé"}`,
    `Date de course : ${plan.race_date ?? "Non précisé"}`,
    `Objectif : ${plan.target_time ?? "Non précisé"}`,
    "",
    `Contexte : l'athlète est à la semaine ${currentWeek} / ${totalWeeks}. Il a manqué ${recentlySkippedCount} séance${recentlySkippedCount > 1 ? "s" : ""} récemment.`,
    `La semaine ${currentWeek + 1} (première semaine régénérée) doit être une reprise légère : charge réduite, pas de fractionné intense. Reprendre la progression normale à partir de la semaine ${currentWeek + 2}.`,
    "",
  ]

  if (snapshot.vo2max || snapshot.threshold_pace || snapshot.vma_derived) {
    lines.push("Données de forme (ne pas rappeler queryFitnessAssessmentOverview) :")
    if (snapshot.vo2max)         lines.push(`  VO2max : ${snapshot.vo2max}`)
    if (snapshot.threshold_pace) lines.push(`  Seuil : ${snapshot.threshold_pace}`)
    if (snapshot.running_level)  lines.push(`  Niveau : ${snapshot.running_level}`)
    if (snapshot.vma_derived)    lines.push(`  VMA dérivée : ${snapshot.vma_derived} km/h`)
    const predStr = [
      preds.five_k  && `5k ${preds.five_k}`,
      preds.ten_k   && `10k ${preds.ten_k}`,
      preds.half    && `semi ${preds.half}`,
    ].filter(Boolean).join(", ")
    if (predStr) lines.push(`  Prédictions : ${predStr}`)
    lines.push("")
  }

  const exampleStartWeek = currentWeek + 1
  lines.push(
    "Structure JSON attendue (UNIQUEMENT ce JSON, rien d'autre) :",
    JSON.stringify({
      sessions: [
        {
          week_number: exampleStartWeek,
          block: "intensification",
          zone: "A",
          type: "facile",
          title: "Sortie facile de reprise",
          details: { duration: "40min", pace: "6:10/km", notes: "Reprise légère après interruption" },
        },
        {
          week_number: exampleStartWeek,
          block: "intensification",
          zone: "B",
          type: "tempo",
          title: "Tempo court",
          details: { warmup: "15min", duration: "20min", pace: "5:10/km", cooldown: "10min", notes: "Intensité modérée, semaine de reprise" },
        },
        {
          week_number: exampleStartWeek,
          block: "intensification",
          zone: "C",
          type: "sortie_longue",
          title: "Sortie longue modérée",
          details: { duration: "1h10", pace: "6:15/km", notes: "Volume réduit, reprise progressive" },
        },
        {
          week_number: exampleStartWeek,
          block: "intensification",
          zone: "renfo",
          type: "renfo",
          title: "Renforcement musculaire",
          details: { exercises: [{ name: "Gainage planche", sets: 3, duration: "45s", rest: "30s" }] },
        },
      ],
    }, null, 2),
  )

  return lines.join("\n")
}

async function regeneratePlanInBackground(
  supabaseAdmin: ReturnType<typeof createClient>,
  planId: string,
  userId: string,
  corosToken: string,
  plan: Record<string, unknown>,
  currentWeek: number,
  totalWeeks: number,
  recentlySkippedCount: number,
) {
  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY manquante")

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
        max_tokens: 12000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(plan, currentWeek, totalWeeks, recentlySkippedCount) }],
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
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`)
    }

    const anthropicData = await anthropicRes.json()
    const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
    const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

    if (!rawText) {
      console.error("[regenerate-plan] Réponse Anthropic vide:", JSON.stringify(anthropicData))
      throw new Error("Réponse Anthropic vide ou inattendue")
    }

    const cleaned = extractJson(rawText)
    let planData: { sessions?: unknown[] }
    try {
      planData = JSON.parse(cleaned)
    } catch (err) {
      console.error("[regenerate-plan] JSON parse error:", err)
      console.error("[regenerate-plan] Raw:", rawText.slice(0, 500))
      throw new Error(`JSON invalide: ${err instanceof Error ? err.message : String(err)}`)
    }

    const sessions = planData.sessions ?? []
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new Error("Aucune séance dans la régénération")
    }

    // Filtrer uniquement les semaines futures (sécurité au cas où l'IA génère des semaines passées)
    const futureSessions = (sessions as Record<string, unknown>[]).filter(
      (s) => typeof s.week_number === "number" && (s.week_number as number) > currentWeek,
    )

    if (futureSessions.length === 0) {
      throw new Error("L'IA n'a généré aucune séance pour les semaines futures")
    }

    // Supprimer les séances futures 'à_venir' seulement maintenant (après succès de l'IA)
    const { error: deleteErr } = await supabaseAdmin
      .from("training_sessions")
      .delete()
      .eq("plan_id", planId)
      .eq("status", "à_venir")
      .gt("week_number", currentWeek)
    if (deleteErr) throw new Error(`Suppression séances: ${deleteErr.message}`)

    // Insérer les nouvelles séances
    const rows = futureSessions.map((s) => ({
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

    const { error: updateError } = await supabaseAdmin.from("training_plans").update({
      generation_status: "ready",
    }).eq("id", planId)
    if (updateError) throw new Error(`Update plan: ${updateError.message}`)

    console.log(`[regenerate-plan] Plan ${planId} régénéré : ${futureSessions.length} séances (sem. ${currentWeek + 1}–${totalWeeks})`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[regenerate-plan] Background error:", message)
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
    console.error("[regenerate-plan] Uncaught:", message)
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
  let planId: string
  try {
    const body = await req.json()
    planId = body.planId
    if (!planId) throw new Error("planId requis")
  } catch (err) {
    return Response.json({ error: "Body invalide", detail: String(err) }, { status: 400, headers: CORS })
  }

  // 3. Récupérer le plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("id, start_date, race_name, race_date, race_distance, target_time, fitness_snapshot, vma_source")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  if (planErr || !plan) {
    return Response.json({ error: "Plan introuvable" }, { status: 404, headers: CORS })
  }

  // 4. Calculer la semaine courante
  const startDate = new Date(plan.start_date as string)
  const today = new Date()
  const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (24 * 3600 * 1000))
  const currentWeek = Math.max(1, Math.floor(daysDiff / 7) + 1)

  // 5. Calculer le nombre total de semaines
  const { data: existingSessions } = await supabaseAdmin
    .from("training_sessions")
    .select("week_number, status")
    .eq("plan_id", planId)

  const sessionsArr = (existingSessions ?? []) as Array<{ week_number: number; status: string }>
  const maxExistingWeek = sessionsArr.reduce((m, s) => Math.max(m, s.week_number ?? 1), currentWeek)

  let totalWeeks = maxExistingWeek
  if (plan.race_date) {
    const raceDate = new Date(plan.race_date as string)
    const weeksFromStart = Math.round((raceDate.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000))
    totalWeeks = Math.max(maxExistingWeek, weeksFromStart)
  }

  if (currentWeek >= totalWeeks) {
    return Response.json({ error: "Aucune semaine future à régénérer" }, { status: 400, headers: CORS })
  }

  // 6. Compter les séances récemment sautées (contexte pour l'IA)
  const recentlySkippedCount = sessionsArr.filter(
    (s) => s.status === "sautée" && s.week_number >= Math.max(1, currentWeek - 2),
  ).length

  // 7. Marquer le plan en cours de régénération
  const { error: updateErr } = await supabaseAdmin
    .from("training_plans")
    .update({ generation_status: "generating" })
    .eq("id", planId)
  if (updateErr) {
    return Response.json({ error: "Erreur mise à jour plan", detail: updateErr.message }, { status: 500, headers: CORS })
  }

  // 8. Token Coros
  let corosToken: string
  try {
    corosToken = await getValidCorosToken(supabaseAdmin, user.id)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    await supabaseAdmin.from("training_plans").update({
      generation_status: "error",
      generation_error: "Coros authentication required",
    }).eq("id", planId)
    return Response.json({ error: "Coros authentication required", detail }, { status: 503, headers: CORS })
  }

  // 9. Lancer en arrière-plan et répondre immédiatement
  EdgeRuntime.waitUntil(
    regeneratePlanInBackground(
      supabaseAdmin,
      planId,
      user.id,
      corosToken,
      plan as Record<string, unknown>,
      currentWeek,
      totalWeeks,
      recentlySkippedCount,
    ),
  )

  console.log(`[regenerate-plan] Plan ${planId} : régénération lancée (sem. ${currentWeek + 1}–${totalWeeks})`)
  return Response.json({ planId, status: "generating" }, { headers: CORS })
}
