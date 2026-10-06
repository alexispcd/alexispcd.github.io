// Synchronisation de la copie Coros d'une séance déjà envoyée sur la montre.
// Partagée par coros-push (action update) et adapt-sessions, sans passer par HTTP.
//
// Limites du MCP Coros : une séance planifiée ne peut être ni déplacée ni
// supprimée. Seul son contenu peut être remplacé, à la même date, tant qu'elle
// est editable (ni faite, ni passée).

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"
import { callCorosTool } from "../coros-mcp.ts"
import { getValidCorosToken } from "../coros-token.ts"
import { buildCorosCourse, CorosCourseError } from "./coros-course.ts"
import { dayTs, todayISO } from "./weeks.ts"
import type { PlanStep } from "./types.ts"

const STEP_COLS = "order_index, step_type, repeat_group, repeat_index, target_pace_sec, pace_tolerance_sec, distance_m, duration_sec"

// Messages courts écrits dans coros_sync_error, jamais le texte brut de Coros.
export const SYNC_ERROR = {
  notConnected: "Coros n'est plus connecté : reconnecte-le dans les réglages.",
  notEditable: "La copie sur la montre n'est plus modifiable (faite ou passée).",
  invalidCourse: "Séance impossible à convertir pour la montre.",
  failed: "Mise à jour de la montre impossible pour le moment.",
} as const

/** yyyy-MM-dd vers yyyyMMdd (format Coros). */
export const toCorosDate = (iso: string): string => iso.slice(0, 10).replace(/-/g, "")

/**
 * idInPlan lu sur le texte BRUT de la réponse (prose « idInPlan: 25 » ou JSON),
 * jamais via JSON.parse : un entier 64 bits y perdrait sa précision.
 */
export function parseIdInPlan(text: string): string | null {
  const m = text.match(/"?idInPlan"?\s*[:=]\s*"?(\d+)/i)
  return m ? m[1] : null
}

/** Indicateur editable de queryScheduledWorkoutDetails, null s'il est absent. */
export function parseEditable(text: string): boolean | null {
  const m = text.match(/"?editable"?\s*[:=]\s*"?(true|false)/i)
  return m ? m[1].toLowerCase() === "true" : null
}

/** Vrai si une copie datée de `isoDate` peut encore être modifiée (aujourd'hui ou plus tard). */
export const isUpcoming = (isoDate: string | null | undefined): boolean =>
  Boolean(isoDate) && dayTs(isoDate) >= dayTs(todayISO())

/** Erreur de token Coros : absence de connexion ou refresh refusé. */
export class CorosNotConnectedError extends Error {}

/** Token Coros mémorisé pour une suite d'appels (adaptation de plusieurs séances). */
export type TokenProvider = () => Promise<string>

export const corosTokenProvider = (admin: SupabaseClient, userId: string): TokenProvider => {
  let pending: Promise<string> | null = null
  return () => {
    pending ??= getValidCorosToken(admin, userId).catch((err) => {
      pending = null
      console.error("[coros-sync] token indisponible:", err instanceof Error ? err.message.slice(0, 200) : err)
      throw new CorosNotConnectedError(SYNC_ERROR.notConnected)
    })
    return pending
  }
}

export type SyncStatus = "no_copy" | "past" | "updated" | "not_editable" | "error"

export interface SyncResult {
  status: SyncStatus
  error: string | null
  coros_workout_id?: string
}

const writeSyncState = async (
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await admin
    .from("training_sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("user_id", userId)
  if (error) console.error("[coros-sync] écriture état échec", sessionId, error.message)
}

/**
 * Met à jour la copie Coros d'une séance avec son contenu actuel.
 * - sans copie, ou copie datée d'avant aujourd'hui : ne fait rien ;
 * - sinon queryScheduledWorkoutDetails puis updateScheduledWorkout si editable.
 * N'échoue jamais : un problème est écrit dans coros_sync_error (message court
 * en français) et renvoyé dans le résultat ; un succès le remet à null.
 */
export async function syncCorosCopy(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
  getToken: TokenProvider = corosTokenProvider(admin, userId),
): Promise<SyncResult> {
  const { data: row, error } = await admin
    .from("training_sessions")
    .select(`title, rationale, coros_workout_id, coros_workout_date, session_steps(${STEP_COLS})`)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !row) {
    console.error("[coros-sync] lecture séance échec", sessionId, error?.message)
    return { status: "error", error: SYNC_ERROR.failed }
  }
  const idInPlan = row.coros_workout_id as string | null
  const copyDate = row.coros_workout_date as string | null
  if (!idInPlan || !copyDate) return { status: "no_copy", error: null }
  if (!isUpcoming(copyDate)) return { status: "past", error: null }

  const fail = async (status: SyncStatus, message: string): Promise<SyncResult> => {
    await writeSyncState(admin, userId, sessionId, { coros_sync_error: message })
    return { status, error: message }
  }

  let course
  try {
    course = buildCorosCourse(
      { title: row.title as string, rationale: row.rationale as string | null },
      (row.session_steps ?? []) as PlanStep[],
    )
  } catch (err) {
    if (err instanceof CorosCourseError) return fail("error", SYNC_ERROR.invalidCourse)
    throw err
  }

  const date = toCorosDate(copyDate)
  try {
    const token = await getToken()
    const details = await callCorosTool(token, "queryScheduledWorkoutDetails", { date, idInPlan })
    if (parseEditable(details) !== true) return fail("not_editable", SYNC_ERROR.notEditable)

    const result = await callCorosTool(token, "updateScheduledWorkout", { date, idInPlan, course })
    // Coros peut réattribuer l'idInPlan à l'enregistrement : on garde toujours le dernier.
    const nextId = parseIdInPlan(result) ?? idInPlan
    await writeSyncState(admin, userId, sessionId, { coros_workout_id: nextId, coros_sync_error: null })
    return { status: "updated", error: null, coros_workout_id: nextId }
  } catch (err) {
    if (err instanceof CorosNotConnectedError) return fail("error", SYNC_ERROR.notConnected)
    console.error("[coros-sync] échec", sessionId, err instanceof Error ? err.message.slice(0, 300) : err)
    return fail("error", SYNC_ERROR.failed)
  }
}
