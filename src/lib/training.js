import supabase from './supabase'
import { callFunction } from './functions'
import { plannedMeters, totalSeconds } from '../apps/training/sessionMath'
import { currentWeekNumber } from '../apps/training/constants'

// ─────────────────────────────────────────────────────────────────────────────
// LECTURES
// ─────────────────────────────────────────────────────────────────────────────

/** Plan actif de l'utilisateur (ou null). */
export const getActivePlan = async () => {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

/** Historique : plans terminés / archivés + nombre de semaines. */
export const getPlans = async () => {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*, training_weeks(count)')
    .in('status', ['completed', 'archived'])
    .order('race_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(({ training_weeks, ...plan }) => ({
    ...plan,
    week_count: training_weeks?.[0]?.count ?? 0,
  }))
}

// Séance lue avec ses étapes : étapes triées, km prévus et durée estimée.
const completerSeance = ({ session_steps, ...s }) => {
  const steps = (session_steps ?? [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  return {
    ...s,
    steps,
    agg_distance_m: plannedMeters(steps) || null,
    agg_duration_sec: totalSeconds(steps) || null,
  }
}

/**
 * Complète un plan déjà lu avec ses semaines ordonnées et toutes ses séances, en une
 * requête de séances.
 * - plan.sessions : chaque séance avec `steps` triés par order_index, `agg_distance_m`
 *   (km prévus, plannedMeters) et `agg_duration_sec` (durée estimée).
 * - plan.weeks : chaque semaine avec `agg_distance_m`, somme des km prévus de ses
 *   séances (target_km, cible de la génération, n'est jamais affiché).
 */
const completerPlan = async (plan) => {
  const { data: weeks, error: weeksErr } = await supabase
    .from('training_weeks')
    .select('*')
    .eq('plan_id', plan.id)
    .order('week_number', { ascending: true })
  if (weeksErr) throw weeksErr

  const { data: sessRows, error: sessErr } = await supabase
    .from('training_sessions')
    .select('*, session_steps(distance_m, duration_sec, target_pace_sec, step_type, order_index)')
    .eq('plan_id', plan.id)
    .order('scheduled_date', { ascending: true })
  if (sessErr) throw sessErr

  const sessions = (sessRows ?? []).map(completerSeance)

  const metersByWeek = {}
  for (const s of sessions) {
    metersByWeek[s.week_id] = (metersByWeek[s.week_id] ?? 0) + (s.agg_distance_m ?? 0)
  }

  return {
    ...plan,
    weeks: (weeks ?? []).map((w) => ({ ...w, agg_distance_m: metersByWeek[w.id] ?? 0 })),
    sessions,
  }
}

/**
 * Lecture légère du bloc « Aujourd'hui » de l'Accueil (lot A2) : le plan actif, ses
 * semaines, et les séances de la semaine en cours (`currentWeekNumber`) et de la
 * suivante, complétées comme dans completerPlan. → { plan, weeks, sessions }, ou
 * { plan: null } sans plan actif.
 */
export const getAujourdhui = async () => {
  const plan = await getActivePlan()
  if (!plan) return { plan: null, weeks: [], sessions: [] }

  const { data: weeks, error: weeksErr } = await supabase
    .from('training_weeks')
    .select('*')
    .eq('plan_id', plan.id)
    .order('week_number', { ascending: true })
  if (weeksErr) throw weeksErr

  const numero = currentWeekNumber(weeks ?? [])
  const ids = (weeks ?? [])
    .filter((w) => w.week_number === numero || w.week_number === numero + 1)
    .map((w) => w.id)
  if (!ids.length) return { plan, weeks: weeks ?? [], sessions: [] }

  const { data: rows, error: sessErr } = await supabase
    .from('training_sessions')
    .select('*, session_steps(distance_m, duration_sec, target_pace_sec, step_type, order_index)')
    .in('week_id', ids)
    .order('scheduled_date', { ascending: true })
  if (sessErr) throw sessErr

  return { plan, weeks: weeks ?? [], sessions: (rows ?? []).map(completerSeance) }
}

/** Plan complet (semaines et séances, voir completerPlan). */
export const getPlan = async (planId) => {
  const { data: plan, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (error) throw error
  return completerPlan(plan)
}

/**
 * Plan courant de /training (lot T1b) : le plan actif complet, ou null s'il n'y en a
 * pas. Le plan n'est lu qu'une fois.
 */
export const getCurrentPlan = async () => {
  const plan = await getActivePlan()
  return plan ? completerPlan(plan) : null
}

/**
 * Séance + steps ordonnés + numéro, bloc et début (week_start) de la semaine parente,
 * et `plan` : statut, date et distance de la course du plan (page séance, lot T2a).
 */
export const getSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, session_steps(*), week:training_weeks(week_number, block, start_date), plan:training_plans(status, race_date, race_distance_m)')
    .eq('id', sessionId)
    .single()
  if (error) throw error

  const { session_steps, week, plan, ...session } = data
  const steps = (session_steps ?? [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  return {
    ...session,
    steps,
    week_number: week?.week_number ?? null,
    block: week?.block ?? null,
    week_start: week?.start_date ?? null,
    plan: plan ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRITURES (plans)
// ─────────────────────────────────────────────────────────────────────────────

export const archivePlan = async (planId) => {
  const { error } = await supabase
    .from('training_plans')
    .update({ status: 'archived' })
    .eq('id', planId)
  if (error) throw error
}

/**
 * Nombre de séances d'un plan envoyées sur la montre avec une copie encore à
 * venir. fromWeek limite aux semaines de numéro >= fromWeek (régénération).
 */
export const countUpcomingOnWatch = async (planId, fromWeek = null) => {
  const today = new Date().toLocaleDateString('en-CA')
  let query = supabase
    .from('training_sessions')
    .select('id, training_weeks!inner(week_number)', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .not('coros_workout_id', 'is', null)
    .gte('coros_workout_date', today)
  if (fromWeek != null) query = query.gte('training_weeks.week_number', fromWeek)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export const deletePlan = async (planId) => {
  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', planId)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRITURES (séances)
// ─────────────────────────────────────────────────────────────────────────────

export const skipSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({ status: 'skipped' })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Annule un saut / une adaptation.
 * - status 'adapted' + previous_version → restaure le contenu original, et sa
 *   copie Coros si la séance est sur la montre.
 * - sinon → simple retour à 'planned'.
 * → { corosError } : message si la mise à jour de la montre a échoué, sinon null.
 */
export const unskipSession = async (sessionId) => {
  const { data: s, error } = await supabase
    .from('training_sessions')
    .select('status, previous_version, coros_workout_id')
    .eq('id', sessionId)
    .single()
  if (error) throw error

  if (s.status === 'adapted' && s.previous_version) {
    const pv = s.previous_version
    const { error: updErr } = await supabase
      .from('training_sessions')
      .update({
        title: pv.title,
        rationale: pv.rationale ?? null,
        notes: pv.notes ?? null,
        // pv.type absent des previous_version d'avant cette évolution : ne le
        // restaure que s'il existe, sinon on laisse le type courant.
        ...(pv.type ? { type: pv.type } : {}),
        status: 'planned',
        adapted_at: null,
        adapted_by_session_id: null,
        previous_version: null,
      })
      .eq('id', sessionId)
    if (updErr) throw updErr

    // Restaure les steps de course depuis le snapshot.
    if (Array.isArray(pv.steps)) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('session_steps').delete().eq('session_id', sessionId)
      const rows = pv.steps.map((st) => ({
        session_id: sessionId,
        user_id: user?.id,
        order_index: st.order_index,
        step_type: st.step_type,
        repeat_group: st.repeat_group ?? null,
        repeat_index: st.repeat_index ?? null,
        target_pace_sec: st.target_pace_sec ?? null,
        pace_tolerance_sec: st.pace_tolerance_sec ?? 5,
        distance_m: st.distance_m ?? null,
        duration_sec: st.duration_sec ?? null,
      }))
      if (rows.length) await supabase.from('session_steps').insert(rows)
    }

    // Copie sur la montre : on y remet la version d'origine. Un échec ne bloque
    // pas la restauration, il est renvoyé pour être signalé à l'utilisateur.
    if (s.coros_workout_id) {
      try {
        const res = await updateOnCoros(sessionId)
        return { corosError: res?.error ?? null }
      } catch (e) {
        return { corosError: e.message || 'Mise à jour de la montre impossible.' }
      }
    }
    return { corosError: null }
  }

  const { error: updErr } = await supabase
    .from('training_sessions')
    .update({ status: 'planned' })
    .eq('id', sessionId)
  if (updErr) throw updErr
  return { corosError: null }
}

/**
 * Réinitialise une séance complétée à l'état "planned" : activités liées, laps,
 * analyse et ressenti (rpe, pain_areas, feedback_note) effacés.
 */
export const resetSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({
      status: 'planned',
      completed_at: null,
      coros_activity_id: null,
      coros_activity_ids: null,
      actual_laps: null,
      km_laps: null,
      analysis: null,
      rpe: null,
      pain_areas: null,
      feedback_note: null,
    })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// EDGE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Lance la génération d'un plan. payload = GenerateInput. → { plan_id } */
export const generatePlan = (payload) => callFunction('generate-plan', payload)

/** Régénère les semaines restantes. → { plan_id } */
export const regeneratePlan = (planId) => callFunction('regenerate-plan', { plan_id: planId })


/** Adapte les séances suivant une séance sautée. → { sessions } */
export const adaptSessions = (sessionId) => callFunction('adapt-sessions', { session_id: sessionId })

/** Cherche les activités Coros candidates pour une séance. → { candidates } */
export const corosMatch = (sessionId) => callFunction('coros-match', { session_id: sessionId })

/**
 * Complète une séance (avec ou sans activité Coros). → { session }
 * corosActivities = liste d'activités Coros [{ id, start_timestamp }] (1 à 3), ou
 * null si aucune activité (validation manuelle). Le serveur les trie par start_timestamp
 * croissant puis concatène leurs laps. feedback = { rpe, pain_areas,
 * feedback_note } ou null (ressenti post-séance). completedDate = date réelle de
 * la séance (yyyy-MM-dd), transmise seulement sur le chemin manuel sans Coros ;
 * avec Coros le serveur prend le timestamp de l'activité.
 */
export const completeSession = (sessionId, corosActivities = null, feedback = null, completedDate = null) =>
  callFunction('complete-session', {
    session_id: sessionId,
    coros_activities: corosActivities,
    feedback,
    ...(completedDate ? { completed_date: completedDate } : {}),
  })

/**
 * Envoie une séance de course sur la montre via Coros, à la date choisie
 * (yyyy-MM-dd). → { coros_workout_id, coros_workout_date, coros_pushed_at, previous_copy }
 * Coros non connecté : erreur avec status 409 et body.code 'coros_not_connected'.
 */
export const pushToCoros = (sessionId, date) =>
  callFunction('coros-push', { action: 'push', session_id: sessionId, date })

/** Met à jour la copie Coros d'une séance déjà envoyée. → { status, error } */
export const updateOnCoros = (sessionId) =>
  callFunction('coros-push', { action: 'update', session_id: sessionId })

/** Bilan de forme Coros pour le wizard. */
export const getCorosFitness = () => callFunction('coros-fitness', undefined)

/** Etat de la connexion OAuth Coros. -> { connected } */
export const getCorosStatus = () => callFunction('coros-oauth', { action: 'status' })

/** Prepare une connexion OAuth Coros. -> { url } vers l'ecran d'autorisation. */
export const startCorosOauth = () => callFunction('coros-oauth', { action: 'start' })

/** Deconnecte Coros (suppression locale des tokens). -> { connected: false } */
export const disconnectCoros = () => callFunction('coros-oauth', { action: 'disconnect' })

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME / POLLING : suivi du statut de génération
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notifie quand generation_status passe à 'ready' ou 'error'.
 * Polling 4s (fallback) + Realtime (prend le relais si activé).
 * Retourne une fonction de désabonnement.
 */
export const subscribeToPlan = (planId, callback) => {
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from('training_plans')
      .select('generation_status, generation_error')
      .eq('id', planId)
      .single()
    if (data?.generation_status === 'ready' || data?.generation_status === 'error') {
      clearInterval(interval)
      callback(data.generation_status, data.generation_error ?? null)
    }
  }, 4000)

  const channel = supabase
    .channel(`plan-${planId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'training_plans', filter: `id=eq.${planId}` },
      (payload) => {
        const status = payload.new.generation_status
        if (status === 'ready' || status === 'error') {
          clearInterval(interval)
          channel.unsubscribe()
          callback(status, payload.new.generation_error ?? null)
        }
      }
    )
    .subscribe()

  return () => {
    clearInterval(interval)
    channel.unsubscribe()
  }
}
