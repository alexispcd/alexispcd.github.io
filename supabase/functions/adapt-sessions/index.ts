import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ZONE_ORDER = ["A", "B", "C", "renfo"]

interface Session {
  id: string
  week_number: number
  zone: string
  type: string
  title: string
  details: unknown
  previous_details: unknown
  status: string
}

interface Plan {
  id: string
  race_name: string | null
  race_date: string | null
  target_time: string | null
  fitness_snapshot: Record<string, unknown> | null
}

function extractJson(raw: string): string {
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) return block[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  return start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim()
}

function buildAdaptPrompt(
  plan: Plan,
  skipped: Session,
  upcoming: Session[],
  recentSkippedCount: number,
  windowSize: number,
): string {
  const snapshot = plan.fitness_snapshot ?? {}

  const lines = [
    "Tu es un coach running. Une séance vient d'être sautée dans un plan d'entraînement.",
    "",
    `Course cible : ${plan.race_name ?? "Non précisé"} — objectif ${plan.target_time ?? "Non précisé"}`,
    `Date de course : ${plan.race_date ?? "Non précisé"}`,
  ]

  if (snapshot.threshold_pace)  lines.push(`Allure seuil : ${snapshot.threshold_pace}`)
  if (snapshot.vma_derived)     lines.push(`VMA dérivée : ${snapshot.vma_derived} km/h`)
  if (snapshot.vo2max)          lines.push(`VO2max : ${snapshot.vo2max}`)

  lines.push(
    "",
    "Séance sautée :",
    `  Zone ${skipped.zone} — ${skipped.type} — "${skipped.title}"`,
    `  Semaine ${skipped.week_number}`,
    `  Détails : ${JSON.stringify(skipped.details)}`,
    "",
    `Séances récemment sautées (contexte) : ${recentSkippedCount}`,
    `Fenêtre d'adaptation : ${windowSize} prochaines séances`,
    "",
    "Séances à venir à adapter (avec leur id) :",
    ...upcoming.slice(0, windowSize).map((s, i) =>
      `  ${i + 1}. id="${s.id}" — Sem.${s.week_number} Zone ${s.zone} — ${s.type} — "${s.title}" — ${JSON.stringify(s.details)}`
    ),
    "",
    "Règles d'adaptation (OBLIGATOIRES) :",
    "- Séance qualité sautée (fractionné/tempo) → préserver AU MOINS une séance qualité dans la fenêtre",
    "- Sortie longue sautée → reporter une partie du volume sur la sortie longue suivante (max +15% durée/distance)",
    "- Séance facile ou renfo sautée → NE PAS compenser, garder les séances telles quelles",
    "- JAMAIS deux séances dures consécutives pour rattraper",
    "- Progressivité : ne pas augmenter la charge de plus d'une séance à la fois",
    "",
    "Retourne UNIQUEMENT ce JSON, commence par { et termine par } :",
    JSON.stringify({
      adapted: [
        {
          id: "uuid-de-la-séance",
          title: "Nouveau titre si changé",
          details: { "...": "nouveaux détails selon le type" },
        },
      ],
    }, null, 2),
    "",
    "N'inclure dans 'adapted' QUE les séances réellement modifiées (pas toutes les séances).",
    "Si une séance n'a pas besoin d'être modifiée, ne pas l'inclure.",
    "Si la séance sautée est facile ou renfo, retourner { adapted: [] }.",
  )

  return lines.join("\n")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[adapt-sessions] Uncaught:", message)
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
  let planId: string, skippedSessionId: string
  try {
    const body = await req.json()
    planId = body.planId
    skippedSessionId = body.skippedSessionId
    if (!planId || !skippedSessionId) throw new Error("planId et skippedSessionId requis")
  } catch (err) {
    return Response.json({ error: "Body invalide", detail: String(err) }, { status: 400, headers: CORS })
  }

  // 3a. Récupérer le plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("id, race_name, race_date, target_time, fitness_snapshot")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  if (planErr || !plan) {
    return Response.json({ error: "Plan introuvable" }, { status: 404, headers: CORS })
  }

  // 3b. Récupérer la séance sautée
  const { data: skipped, error: skippedErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, week_number, zone, type, title, details, previous_details, status")
    .eq("id", skippedSessionId)
    .eq("plan_id", planId)
    .single()
  if (skippedErr || !skipped) {
    return Response.json({ error: "Séance introuvable" }, { status: 404, headers: CORS })
  }

  // 3c. Séances à venir (status='à_venir'), triées par week_number + zone
  const { data: upcoming, error: upcomingErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, week_number, zone, type, title, details, previous_details, status")
    .eq("plan_id", planId)
    .eq("status", "à_venir")
    .gte("week_number", (skipped as Session).week_number)
    .order("week_number", { ascending: true })
    .limit(5)
  if (upcomingErr) {
    return Response.json({ error: "Erreur lecture séances", detail: upcomingErr.message }, { status: 500, headers: CORS })
  }

  // 3d. Compter les séances récemment sautées (4 dernières semaines autour de la séance sautée)
  const skippedWeek = (skipped as Session).week_number
  const { count: recentSkippedCount } = await supabaseAdmin
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId)
    .eq("status", "sautée")
    .gte("week_number", Math.max(1, skippedWeek - 2))
    .lte("week_number", skippedWeek)

  const skippedCount = recentSkippedCount ?? 0
  console.log(`[adapt-sessions] séances sautées récentes : ${skippedCount}`)

  // 4. Déterminer la fenêtre d'adaptation
  if (skippedCount >= 3) {
    console.log("[adapt-sessions] 3+ séances sautées → régénération conseillée")
    return Response.json({ regenerate: true, adaptedCount: 0 }, { headers: CORS })
  }

  const windowSize = skippedCount >= 2 ? 5 : 3
  console.log(`[adapt-sessions] fenêtre = ${windowSize} séances (${skippedCount} sautées récemment)`)

  // Séances facile/renfo sautées → rien à adapter
  const skippedType = (skipped as Session).type
  if (skippedType === "facile" || skippedType === "renfo") {
    console.log("[adapt-sessions] séance facile/renfo → pas d'adaptation nécessaire")
    return Response.json({ adaptedCount: 0 }, { headers: CORS })
  }

  const upcomingList = (upcoming ?? []) as Session[]
  if (upcomingList.length === 0) {
    return Response.json({ adaptedCount: 0 }, { headers: CORS })
  }

  // 5. Appel Anthropic
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!anthropicKey) return Response.json({ error: "Server configuration error" }, { status: 500, headers: CORS })

  const prompt = buildAdaptPrompt(plan as Plan, skipped as Session, upcomingList, skippedCount, windowSize)
  console.log("[adapt-sessions] appel Anthropic pour adaptation")

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "")
    console.error("[adapt-sessions] Anthropic error:", anthropicRes.status, errText)
    return Response.json({ error: "Anthropic API error", detail: errText }, { status: 502, headers: CORS })
  }

  const anthropicData = await anthropicRes.json()
  const blocks: Array<{ type: string; text?: string }> = anthropicData.content ?? []
  const rawText = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")

  if (!rawText) {
    console.error("[adapt-sessions] Réponse Anthropic vide:", JSON.stringify(anthropicData))
    return Response.json({ error: "Réponse Anthropic vide" }, { status: 502, headers: CORS })
  }

  // Extraction JSON robuste
  let adaptData: { adapted: Array<{ id: string; title?: string; details?: unknown }> }
  try {
    adaptData = JSON.parse(extractJson(rawText))
  } catch (err) {
    console.error("[adapt-sessions] JSON parse error:", err)
    console.error("[adapt-sessions] Raw:", rawText.slice(0, 300))
    return Response.json({ error: "JSON invalide dans la réponse IA", detail: String(err) }, { status: 502, headers: CORS })
  }

  const adaptedList = adaptData.adapted ?? []
  if (adaptedList.length === 0) {
    return Response.json({ adaptedCount: 0 }, { headers: CORS })
  }

  // 6. Mettre à jour chaque séance adaptée
  // Construire un index des séances à venir pour retrouver previous_details
  const upcomingById = new Map(upcomingList.map((s) => [s.id, s]))
  const now = new Date().toISOString()

  const updates = adaptedList.map(async (adapted) => {
    const original = upcomingById.get(adapted.id)
    if (!original) {
      console.warn("[adapt-sessions] séance inconnue ignorée:", adapted.id)
      return false
    }

    // Conserver l'original dans previous_details si c'est la première adaptation
    const previousDetails = original.previous_details ?? original.details

    const { error: updateErr } = await supabaseAdmin
      .from("training_sessions")
      .update({
        details: adapted.details ?? original.details,
        title: adapted.title ?? original.title,
        previous_details: previousDetails,
        status: "adaptée",
        adapted_at: now,
        adapted_by_session_id: skippedSessionId,
      })
      .eq("id", adapted.id)
      .eq("plan_id", planId)

    if (updateErr) {
      console.error("[adapt-sessions] update error for", adapted.id, ":", updateErr.message)
      return false
    }
    return true
  })

  const results = await Promise.all(updates)
  const adaptedCount = results.filter(Boolean).length

  console.log(`[adapt-sessions] ${adaptedCount}/${adaptedList.length} séances adaptées`)
  return Response.json({ adaptedCount }, { headers: CORS })
}
