import supabase from './supabase'
import { callFunction } from './functions'

// Accès aux données du module Renfo. Lectures et écritures directes filtrées par
// la RLS ; la génération passe par les Edge Functions renfo-cycle et renfo-session.

const userId = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')
  return session.user.id
}

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// ── Profil et matériel ───────────────────────────────────────────────────────

/** Profil Renfo du compte, ou null s'il n'existe pas encore. */
export const getProfile = async () =>
  unwrap(await supabase.from('strength_profiles').select('frequency, equipment').maybeSingle())

/** Crée ou met à jour le profil (fréquence, matériel hors élastiques). */
export const saveProfile = async ({ frequency, equipment }) =>
  unwrap(await supabase
    .from('strength_profiles')
    .upsert({ user_id: await userId(), frequency, equipment, updated_at: new Date().toISOString() })
    .select('frequency, equipment')
    .single())

/** Élastiques du compte, du plus léger au plus fort. */
export const getBands = async () =>
  unwrap(await supabase.from('strength_bands').select('id, kg, color').order('kg')).map(
    (b) => ({ ...b, kg: Number(b.kg) }),
  )

// Code Postgres d'une violation de contrainte unique : (user_id, kg) déjà pris.
const UNIQUE_VIOLATION = '23505'

const bandError = (error) => {
  if (error?.code === UNIQUE_VIOLATION) return new Error('Tu as déjà un élastique de ce poids')
  return error
}

export const addBand = async ({ kg, color }) => {
  const { data, error } = await supabase
    .from('strength_bands')
    .insert({ user_id: await userId(), kg, color })
    .select('id, kg, color')
    .single()
  if (error) throw bandError(error)
  return { ...data, kg: Number(data.kg) }
}

export const updateBand = async (id, { kg, color }) => {
  const { data, error } = await supabase
    .from('strength_bands')
    .update({ kg, color })
    .eq('id', id)
    .select('id, kg, color')
    .single()
  if (error) throw bandError(error)
  return { ...data, kg: Number(data.kg) }
}

export const deleteBand = async (id) =>
  unwrap(await supabase.from('strength_bands').delete().eq('id', id))

// ── Cycles et séances ────────────────────────────────────────────────────────

const CYCLE_COLUMNS = 'id, number, start_date, frequency, status, generation_status, generated_weeks, main_exercises'
const SESSION_COLUMNS = 'id, cycle_id, week_index, week_start, position, kind, title, content, status, completed_at, bands_used, rpe, pain_areas, feedback_note, created_at'

/** Cycle actif du compte, ou null. */
export const getActiveCycle = async () =>
  unwrap(await supabase.from('strength_cycles').select(CYCLE_COLUMNS).eq('status', 'active').maybeSingle())

/** État de génération d'un cycle (interrogation régulière pendant la génération). */
export const getCycleStatus = async (cycleId) =>
  unwrap(await supabase
    .from('strength_cycles')
    .select('generation_status, generated_weeks')
    .eq('id', cycleId)
    .single())

/** Séances d'un cycle, par semaine puis par position. */
export const getCycleSessions = async (cycleId) =>
  unwrap(await supabase
    .from('strength_sessions')
    .select(SESSION_COLUMNS)
    .eq('cycle_id', cycleId)
    .order('week_index')
    .order('position'))

/** Séances libres dont la semaine commence entre `fromWeek` et `toWeek` inclus. */
export const getFreeSessions = async (fromWeek, toWeek) =>
  unwrap(await supabase
    .from('strength_sessions')
    .select(SESSION_COLUMNS)
    .is('cycle_id', null)
    .gte('week_start', fromWeek)
    .lte('week_start', toWeek)
    .order('week_start')
    .order('created_at'))

/** Une séance, avec son cycle (numéro) s'il y en a un. */
export const getSession = async (sessionId) =>
  unwrap(await supabase
    .from('strength_sessions')
    .select(`${SESSION_COLUMNS}, cycle:strength_cycles(number)`)
    .eq('id', sessionId)
    .single())

/** Valide une séance : bandes jouées et ressenti (feedback au format toFeedbackPayload, ou null). */
export const completeSession = async (sessionId, { bandsUsed, feedback }) =>
  unwrap(await supabase
    .from('strength_sessions')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      bands_used: bandsUsed && Object.keys(bandsUsed).length ? bandsUsed : null,
      rpe: feedback?.rpe ?? null,
      pain_areas: feedback?.pain_areas ?? null,
      feedback_note: feedback?.feedback_note ?? null,
    })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single())

/** Remet une séance à faire. Les bandes jouées sont conservées. */
export const resetSession = async (sessionId) =>
  unwrap(await supabase
    .from('strength_sessions')
    .update({ status: 'planned', completed_at: null, rpe: null, pain_areas: null, feedback_note: null })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single())

/** Supprime une séance libre (la RLS refuse une séance de cycle). */
export const deleteFreeSession = async (sessionId) =>
  unwrap(await supabase.from('strength_sessions').delete().eq('id', sessionId).is('cycle_id', null))

// ── Génération ───────────────────────────────────────────────────────────────

/** Lance un cycle, ou reprend celui en erreur. 202 { cycle_id }. */
export const startCycle = () => callFunction('renfo-cycle', {})

/** Séance libre synchrone. Renvoie { session }. */
export const createFreeSession = (kind) => callFunction('renfo-session', { kind })
