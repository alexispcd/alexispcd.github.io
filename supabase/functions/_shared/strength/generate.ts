// Génération de séances Renfo par le modèle, commune à renfo-cycle et renfo-session :
// lecture du matériel du compte, appel, validation, un seul retry avec les erreurs.

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"
import { anthropicSimple, type AnthropicMessage } from "../anthropic.ts"
import { extractJson } from "../extract-json.ts"
import type { Equipment } from "./catalog.ts"
import { estimateSessionMinutes } from "./estimate.ts"
import { buildRetryPrompt } from "./prompt.ts"
import type { SessionBlock, SessionContent, SessionKind } from "./rules.ts"
import { validateSessionContent } from "./validate.ts"

/** Même modèle que generate-plan. */
export const MODEL = "claude-sonnet-4-6"

export const PROFILE_MISSING = {
  error: "Règle d'abord ton matériel et ta fréquence",
  code: "profile_missing",
}

export interface StrengthSetup {
  frequency: 1 | 2 | 3
  /** Matériel hors élastiques. */
  equipment: Equipment[]
  bandsKg: number[]
}

/** Profil et élastiques du compte, ou null sans profil. `admin` : client service role. */
export async function loadStrengthSetup(admin: SupabaseClient, userId: string): Promise<StrengthSetup | null> {
  const [profile, bands] = await Promise.all([
    admin.from("strength_profiles").select("frequency, equipment").eq("user_id", userId).maybeSingle(),
    admin.from("strength_bands").select("kg").eq("user_id", userId).order("kg"),
  ])
  if (profile.error) throw new Error(`strength_profiles: ${profile.error.message}`)
  if (bands.error) throw new Error(`strength_bands: ${bands.error.message}`)
  if (!profile.data) return null
  return {
    frequency: profile.data.frequency as 1 | 2 | 3,
    equipment: (profile.data.equipment ?? []) as Equipment[],
    bandsKg: (bands.data ?? []).map((b: { kg: number | string }) => Number(b.kg)),
  }
}

export interface GenerateParams {
  system: string
  userPrompt: string
  kinds: SessionKind[]
  setup: StrengthSetup
  /** Exercices principaux imposés par type, ou null. */
  mainSlugs: Partial<Record<SessionKind, string[]>> | null
  maxTokens: number
  timeoutMs?: number
  /** Préfixe des logs, par exemple [renfo-cycle] <id>. */
  logTag: string
}

export interface GeneratedSession {
  kind: SessionKind
  content: SessionContent
}

export type GenerateResult =
  | { ok: true; sessions: GeneratedSession[] }
  | { ok: false; errors: string[] }

type Checked = { sessions: GeneratedSession[]; errorsByKind: Array<{ kind: string; errors: string[] }> }

/** Analyse la réponse brute : JSON, une entrée par type demandé dans l'ordre, contenu valide. */
function check(raw: string, p: GenerateParams): Checked {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    return { sessions: [], errorsByKind: [{ kind: "réponse", errors: ["JSON illisible"] }] }
  }
  const list = (parsed as { sessions?: unknown })?.sessions
  if (!Array.isArray(list) || list.length !== p.kinds.length) {
    return {
      sessions: [],
      errorsByKind: [{ kind: "réponse", errors: [`sessions doit contenir exactement ${p.kinds.length} entrée(s)`] }],
    }
  }
  const sessions: GeneratedSession[] = []
  const errorsByKind: Checked["errorsByKind"] = []
  p.kinds.forEach((kind, i) => {
    const entry = list[i] as { kind?: unknown; content?: unknown }
    const errors: string[] = []
    if (entry?.kind !== kind) errors.push(`entrée ${i + 1} : kind ${kind} attendu`)
    errors.push(...validateSessionContent(entry?.content, {
      kind,
      equipment: p.setup.equipment,
      bandsKg: p.setup.bandsKg,
      mainSlugs: p.mainSlugs?.[kind],
    }))
    if (errors.length) {
      errorsByKind.push({ kind, errors })
      return
    }
    const content = entry.content as { title: string; blocks: SessionBlock[] }
    sessions.push({
      kind,
      content: {
        title: content.title.trim(),
        estimated_min: estimateSessionMinutes(content),
        blocks: content.blocks,
      },
    })
  })
  return { sessions, errorsByKind }
}

/** Appel modèle, validation, un retry avec la liste des erreurs. */
export async function generateSessions(p: GenerateParams): Promise<GenerateResult> {
  const messages: AnthropicMessage[] = [{ role: "user", content: p.userPrompt }]
  const call = () =>
    anthropicSimple({ model: MODEL, max_tokens: p.maxTokens, system: p.system, messages, timeoutMs: p.timeoutMs })

  const first = await call()
  let result = check(first, p)
  if (!result.errorsByKind.length) return { ok: true, sessions: result.sessions }

  console.warn(`${p.logTag} à corriger (essai 1) :`, JSON.stringify(result.errorsByKind).slice(0, 2000))
  messages.push(
    { role: "assistant", content: first },
    { role: "user", content: buildRetryPrompt(result.errorsByKind) },
  )
  result = check(await call(), p)
  if (!result.errorsByKind.length) return { ok: true, sessions: result.sessions }

  const errors = result.errorsByKind.flatMap(({ kind, errors }) => errors.map((e) => `${kind} : ${e}`))
  return { ok: false, errors }
}
