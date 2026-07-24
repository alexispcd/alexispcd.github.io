import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { anthropicSimple } from "../_shared/anthropic.ts"
import { extractJson } from "../_shared/extract-json.ts"
import { validateStrengthContent } from "../_shared/training/validate.ts"
import {
  baseDurationHint, finalDurationWarning, finalizeStrengthContent,
} from "../_shared/training/strength.ts"
import {
  bonusKindForWeek, detectBonusKind, EXERCISE_INDEX, type ExerciseCategory,
} from "../_shared/training/exercises.ts"
import type { StrengthBlock, StrengthContent } from "../_shared/training/types.ts"
import { todayISO } from "../_shared/training/weeks.ts"
import {
  buildRenfoSystemPrompt, buildRenfoUserPrompt,
  type PastRenfo, type RenfoTarget,
} from "./prompt.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MODEL = "claude-sonnet-4-6"
const MAX_TOKENS = 8000

const json = (status: number, body: unknown) => Response.json(body, { status, headers: CORS })

interface RenfoOut {
  id: string
  strength_content?: unknown
}

/** Extrait la liste des slugs d'un strength_content persisté (rotation/contexte). */
function slugsOf(content: unknown): string[] {
  const blocks = (content as { blocks?: unknown } | null)?.blocks
  if (!Array.isArray(blocks)) return []
  const out: string[] = []
  for (const b of blocks) {
    for (const ex of ((b as { exercises?: unknown }).exercises as Array<{ slug?: string }>) ?? []) {
      if (typeof ex.slug === "string") out.push(ex.slug)
    }
  }
  return out
}

async function callModel(system: string, messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<RenfoOut[]> {
  const text = await anthropicSimple({ model: MODEL, max_tokens: MAX_TOKENS, system, messages })
  const parsed = JSON.parse(extractJson(text)) as { sessions?: RenfoOut[] }
  return parsed.sessions ?? []
}

/**
 * Valide chaque séance régénérée : STRUCTURE renfo (niveau 1, DUR) + parité du
 * bloc bonus. Seules ces erreurs bloquent la régénération. La durée est traitée à
 * part, en soft (voir durationHints).
 */
function validateOut(out: RenfoOut[], byId: Map<string, RenfoTarget>): string[] {
  const errors: string[] = []
  for (const o of out) {
    const cur = byId.get(o.id)
    if (!cur) {
      errors.push(`séance ${o.id} : hors périmètre`)
      continue
    }
    const tag = `séance ${o.id} (semaine ${cur.week_number})`
    validateStrengthContent(o.strength_content, tag, errors)

    // Parité du bloc bonus : doit correspondre à la parité de week_number.
    const blocks = (o.strength_content as { blocks?: StrengthBlock[] } | null)?.blocks
    if (Array.isArray(blocks) && blocks.length === 4) {
      const cats = (blocks[3].exercises ?? [])
        .map((e) => EXERCISE_INDEX[e.slug]?.category)
        .filter(Boolean) as ExerciseCategory[]
      const kind = detectBonusKind(cats)
      const expected = bonusKindForWeek(cur.week_number)
      if (kind && kind !== expected) {
        errors.push(`${tag} : bloc bonus ${kind} mais parité attend ${expected}`)
      }
    }
  }
  return errors
}

/**
 * Niveau 2 (SOUPLE) : indices de durée de la base modèle, hors bande large. Ils
 * déclenchent un retry ciblé mais ne bloquent jamais (règle de sortie : on garde
 * la séance trimmée si le retry échoue).
 */
function durationHints(out: RenfoOut[], byId: Map<string, RenfoTarget>): string[] {
  const hints: string[] = []
  for (const o of out) {
    const cur = byId.get(o.id)
    if (!cur) continue
    const blocks = (o.strength_content as { blocks?: StrengthBlock[] } | null)?.blocks
    if (!Array.isArray(blocks)) continue
    const hint = baseDurationHint(blocks, `séance ${o.id} (semaine ${cur.week_number})`)
    if (hint) hints.push(hint)
  }
  return hints
}

async function handleRequest(req: Request): Promise<Response> {
  // 1. Auth
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json(401, { error: "Missing authorization" })

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  // 2. Corps
  let planId: string
  try {
    const body = await req.json()
    planId = body.plan_id
    if (!planId) throw new Error("plan_id requis")
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  // 3. Plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from("training_plans")
    .select("race_name, race_date, fitness_snapshot")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single()
  if (planErr || !plan) return json(404, { error: "Plan introuvable" })

  // 4. Séances renfo FUTURES et planifiées (à régénérer).
  const today = todayISO()
  const { data: targetRows, error: tErr } = await supabaseAdmin
    .from("training_sessions")
    .select("id, scheduled_date, week:training_weeks(week_number, block)")
    .eq("plan_id", planId)
    .eq("type", "renfo")
    .eq("status", "planned")
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
  if (tErr) return json(500, { error: "Lecture des renfos impossible", detail: tErr.message })

  const targets: RenfoTarget[] = (targetRows ?? []).map((r) => {
    const w = (r as Record<string, unknown>).week as { week_number?: number; block?: string } | null
    return {
      id: (r as Record<string, unknown>).id as string,
      week_number: w?.week_number ?? 0,
      block: w?.block ?? null,
    }
  }).filter((t) => t.week_number > 0)

  if (targets.length === 0) return json(200, { updated: 0, sessions: [] })
  const byId = new Map(targets.map((t) => [t.id, t]))

  // 5. Renfos déjà réalisés (done/adaptées) pour la rotation.
  const { data: pastRows } = await supabaseAdmin
    .from("training_sessions")
    .select("strength_content, week:training_weeks(week_number)")
    .eq("plan_id", planId)
    .eq("type", "renfo")
    .in("status", ["done", "adapted"])
    .order("scheduled_date", { ascending: true })
  const pastRenfos: PastRenfo[] = (pastRows ?? [])
    .map((r) => {
      const w = (r as Record<string, unknown>).week as { week_number?: number } | null
      return { week_number: w?.week_number ?? 0, slugs: slugsOf((r as Record<string, unknown>).strength_content) }
    })
    .filter((p) => p.week_number > 0 && p.slugs.length)

  // 6. Appel Sonnet (+ 1 retry ciblé sur les erreurs de validation).
  const system = buildRenfoSystemPrompt()
  const userPrompt = buildRenfoUserPrompt(plan as never, targets, pastRenfos)

  let out: RenfoOut[]
  try {
    out = await callModel(system, [{ role: "user", content: userPrompt }])
  } catch (err) {
    return json(502, { error: "Erreur IA renfo", detail: err instanceof Error ? err.message : String(err) })
  }

  out = out.filter((o) => byId.has(o.id))
  // Niveau 1 (structure, DUR) : seul blocage. Niveau 2 (durée, SOUPLE) : déclenche
  // le même retry mais ne bloque pas. On retry si l'un des deux a matière.
  let errors = validateOut(out, byId)
  let hints = durationHints(out, byId)
  if (errors.length || hints.length) {
    const corrections = [
      ...errors.map((e) => `- ${e}`),
      ...hints.map((h) => `- ${h}`),
    ]
    try {
      out = await callModel(system, [
        { role: "user", content: userPrompt },
        { role: "assistant", content: JSON.stringify({ sessions: out }) },
        {
          role: "user",
          content: "Le JSON doit être corrigé. Applique STRICTEMENT ces points et renvoie TOUTES les séances :\n" +
            corrections.slice(0, 20).join("\n"),
        },
      ])
      out = out.filter((o) => byId.has(o.id))
      errors = validateOut(out, byId)
      hints = durationHints(out, byId)
    } catch (err) {
      return json(502, { error: "Erreur IA renfo (retry)", detail: err instanceof Error ? err.message : String(err) })
    }
  }
  // Seules les erreurs de STRUCTURE bloquent. Une durée encore hors bande après
  // retry est acceptée : le trim la ramène, une séance imparfaite reste jouable.
  if (errors.length) return json(422, { error: "Régénération renfo invalide", details: errors.slice(0, 10) })
  if (hints.length) console.warn("[regenerate-renfo] durée hors bande après retry (acceptée) :", hints.slice(0, 8))
  if (out.length === 0) return json(200, { updated: 0, sessions: [] })

  // 7. Enrichissement + persistance (uniquement le strength_content, statut inchangé).
  const changedIds: string[] = []
  for (const o of out) {
    const finalized: StrengthContent = finalizeStrengthContent(o.strength_content as never)
    // Niveau 3 (durée finale, DUR) : simple garde-fou logué, jamais bloquant.
    const warn = finalDurationWarning(finalized)
    if (warn) console.warn(`[regenerate-renfo] ${o.id} : ${warn}`)
    const { error: updErr } = await supabaseAdmin
      .from("training_sessions")
      .update({ strength_content: finalized })
      .eq("id", o.id)
      .eq("user_id", user.id)
      .eq("status", "planned")
    if (updErr) {
      console.error("[regenerate-renfo] update échec", o.id, updErr.message)
      continue
    }
    changedIds.push(o.id)
  }

  const { data: updatedRows } = await supabaseAdmin
    .from("training_sessions")
    .select("id, strength_content, week:training_weeks(week_number)")
    .in("id", changedIds.length ? changedIds : ["00000000-0000-0000-0000-000000000000"])
    .order("scheduled_date", { ascending: true })

  return json(200, { updated: changedIds.length, sessions: updatedRows ?? [] })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    return await handleRequest(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[regenerate-renfo] uncaught:", message)
    return json(500, { error: "Internal server error", detail: message })
  }
})
