import supabase from './supabase'
import { callFunction } from './functions'

// Accès aux données du module Renfo. Lectures et écritures directes filtrées par
// la RLS ; la composition passe par l'Edge Function renfo-session.

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
  // `doublon` : message écrit à la main, affiché tel quel par BandDialog.
  if (error?.code === UNIQUE_VIOLATION) return Object.assign(new Error('Tu as déjà un élastique de ce poids'), { doublon: true })
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

/** Séances faites, de cycle comprises, de la plus récente à la plus ancienne (60 au plus). */
export const getDoneSessions = async () =>
  unwrap(await supabase
    .from('strength_sessions')
    .select('id, title, content, completed_at')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(60))

/** Séance à faire hors cycle la plus récente, ou null. */
export const getPendingSession = async () =>
  unwrap(await supabase
    .from('strength_sessions')
    .select(SESSION_COLUMNS)
    .eq('status', 'planned')
    .is('cycle_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle())

/** Une séance, avec son cycle (numéro) s'il y en a un. */
export const getSession = async (sessionId) =>
  unwrap(await supabase
    .from('strength_sessions')
    .select(`${SESSION_COLUMNS}, cycle:strength_cycles(number)`)
    .eq('id', sessionId)
    .single())

/**
 * Valide une séance : bandes jouées et ressenti (feedback au format toFeedbackPayload,
 * ou null). Les bandes jouées deviennent ensuite la base de leurs exercices.
 */
export const completeSession = async (sessionId, { bandsUsed, feedback }) => {
  const hasBands = Boolean(bandsUsed && Object.keys(bandsUsed).length)
  const session = unwrap(await supabase
    .from('strength_sessions')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
      bands_used: hasBands ? bandsUsed : null,
      rpe: feedback?.rpe ?? null,
      pain_areas: feedback?.pain_areas ?? null,
      feedback_note: feedback?.feedback_note ?? null,
    })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single())
  // Jusqu'au lot R4, où Ajuster passera dans le player.
  if (hasBands) await saveBandBases(bandsUsed)
  return session
}

// Élastique de chaque exercice joué dans sa base, sans toucher à reps ni duration_sec.
// Un échec part en console : la séance est déjà validée.
const saveBandBases = async (bandsUsed) => {
  try {
    const user_id = await userId()
    const updated_at = new Date().toISOString()
    const rows = Object.entries(bandsUsed).map(([slug, kg]) => ({ user_id, slug, band_kg: Number(kg), updated_at }))
    const { error } = await supabase.from('strength_exercise_bases').upsert(rows, { onConflict: 'user_id,slug' })
    if (error) throw error
  } catch (e) {
    console.error('[renfo] bases des élastiques non écrites', e)
  }
}

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

// ── Séances composées ────────────────────────────────────────────────────────
// Chaque action renvoie { session }. createSession : l'accueil et la composition
// (lot R2) ; updateSession, adjustExercise, replaceExercise : aucun écran encore.

/** Bases des exercices du compte (dernier réglage) : { [slug]: { reps, duration_sec, band_kg } }. */
export const getExerciseBases = async () => {
  const rows = unwrap(await supabase.from('strength_exercise_bases').select('slug, reps, duration_sec, band_kg'))
  return Object.fromEntries(rows.map(({ slug, reps, duration_sec, band_kg }) =>
    [slug, { reps, duration_sec, band_kg: band_kg == null ? null : Number(band_kg) }]))
}

/**
 * Crée une séance depuis une composition { intensity, supersets: [{ focus, exercise_count, rounds }] }.
 * 409 seance_en_attente (err.body.session) si une séance hors cycle est déjà à faire.
 */
export const createSession = (composition) => callFunction('renfo-session', { action: 'create', composition })

/** Recompose une séance à faire. */
export const updateSession = (sessionId, composition) =>
  callFunction('renfo-session', { action: 'update', session_id: sessionId, composition })

/** Ajuste un exercice : reglage = { slug, reps } ou { slug, duration_sec }, avec band_kg facultatif. */
export const adjustExercise = (sessionId, reglage) =>
  callFunction('renfo-session', { action: 'adjust', session_id: sessionId, ...reglage })

/** Remplace un exercice du bloc blockIndex. */
export const replaceExercise = (sessionId, blockIndex, slug, newSlug) =>
  callFunction('renfo-session', { action: 'replace', session_id: sessionId, block_index: blockIndex, slug, new_slug: newSlug })
