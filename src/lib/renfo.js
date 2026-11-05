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

/**
 * Enregistre les réglages d'un coup, tout ou rien (fonction renfo_enregistrer_reglages) :
 * objectif, matériel, élastiques (tous remplacés) et report des bases d'exercices,
 * report = [{ de, vers }] en kg.
 */
export const enregistrerReglages = async ({ frequency, equipment, bands, report }) =>
  unwrap(await supabase.rpc('renfo_enregistrer_reglages', {
    p_frequency: frequency,
    p_equipment: equipment,
    p_bands: bands.map(({ kg, color }) => ({ kg, color })),
    p_report: report,
  }))

// ── Cycles et séances ────────────────────────────────────────────────────────

const SESSION_COLUMNS = 'id, cycle_id, week_index, week_start, position, kind, title, content, status, completed_at, bands_used, rpe, pain_areas, feedback_note, created_at'

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
 * Valide une séance : bandes jouées (bands_used de la séance, pour une ancienne séance
 * réinitialisée) et ressenti (feedback au format toFeedbackPayload, ou null). Les
 * élastiques réglés dans la séance sont déjà la base de leurs exercices (Ajuster).
 */
export const completeSession = async (sessionId, { bandsUsed, feedback }) => {
  const hasBands = Boolean(bandsUsed && Object.keys(bandsUsed).length)
  return unwrap(await supabase
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
// Chaque action renvoie { session }. createSession : l'accueil et la composition ;
// updateSession : Modifier ; adjustExercise : Ajuster (page séance et player) ;
// replaceExercise : Remplacer.

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
