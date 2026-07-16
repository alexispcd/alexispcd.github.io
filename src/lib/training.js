import supabase from './supabase'
import { totalMeters, totalSeconds } from '../apps/training/sessionMath'

// ─────────────────────────────────────────────────────────────────────────────
// Edge Functions — helper commun (auth + fetch + gestion d'erreur)
// ─────────────────────────────────────────────────────────────────────────────
const callFunction = async (name, body) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = new Error(err.detail ?? err.error ?? `Erreur serveur (${res.status})`)
    error.status = res.status
    error.body = err
    throw error
  }
  return res.json()
}

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

/** Plan + ses semaines ordonnées. */
export const getPlan = async (planId) => {
  const { data: plan, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (error) throw error

  const { data: weeks, error: weeksErr } = await supabase
    .from('training_weeks')
    .select('*')
    .eq('plan_id', planId)
    .order('week_number', { ascending: true })
  if (weeksErr) throw weeksErr

  return { ...plan, weeks: weeks ?? [] }
}

/**
 * Séances d'une semaine (sans steps détaillés), avec un agrégat distance/durée
 * calculé depuis session_steps pour le sous-titre "volume".
 */
export const getWeekSessions = async (weekId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, session_steps(distance_m, duration_sec, target_pace_sec)')
    .eq('week_id', weekId)
    .order('scheduled_date', { ascending: true })
  if (error) throw error

  return (data ?? []).map(({ session_steps, ...s }) => {
    const steps = session_steps ?? []
    return {
      ...s,
      agg_distance_m: totalMeters(steps) || null,
      agg_duration_sec: totalSeconds(steps) || null,
    }
  })
}

/** Séance + steps ordonnés + numéro/bloc de la semaine parente. */
export const getSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, session_steps(*), week:training_weeks(week_number, block)')
    .eq('id', sessionId)
    .single()
  if (error) throw error

  const { session_steps, week, ...session } = data
  const steps = (session_steps ?? [])
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  return {
    ...session,
    steps,
    week_number: week?.week_number ?? null,
    block: week?.block ?? null,
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
 * - status 'adapted' + previous_version → restaure le contenu original.
 * - sinon → simple retour à 'planned'.
 */
export const unskipSession = async (sessionId) => {
  const { data: s, error } = await supabase
    .from('training_sessions')
    .select('status, previous_version')
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
        strength_content: pv.strength_content ?? null,
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
    return
  }

  const { error: updErr } = await supabase
    .from('training_sessions')
    .update({ status: 'planned' })
    .eq('id', sessionId)
  if (updErr) throw updErr
}

/** Persiste le contenu renfo recomposé (durée + blocs). */
export const updateStrengthContent = async (sessionId, strengthContent) => {
  const { error } = await supabase
    .from('training_sessions')
    .update({ strength_content: strengthContent })
    .eq('id', sessionId)
  if (error) throw error
}

/** Réinitialise une séance complétée à l'état "planned". */
export const resetSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({
      status: 'planned',
      completed_at: null,
      coros_activity_id: null,
      actual_laps: null,
      km_laps: null,
      analysis: null,
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

/** Régénère le contenu renfo des séances futures planifiées. → { updated, sessions } */
export const regenerateRenfo = (planId) => callFunction('regenerate-renfo', { plan_id: planId })

/** Adapte les séances suivant une séance sautée. → { sessions } */
export const adaptSessions = (sessionId) => callFunction('adapt-sessions', { session_id: sessionId })

/** Cherche les activités Coros candidates pour une séance. → { candidates } */
export const corosMatch = (sessionId) => callFunction('coros-match', { session_id: sessionId })

/**
 * Complète une séance (avec ou sans activité Coros). → { session }
 * feedback = { rpe, pain_areas, feedback_note } ou null (ressenti post-séance).
 */
export const completeSession = (sessionId, corosActivityId = null, feedback = null) =>
  callFunction('complete-session', {
    session_id: sessionId,
    coros_activity_id: corosActivityId,
    feedback,
  })

/** Bilan de forme Coros pour le wizard. */
export const getCorosFitness = () => callFunction('coros-fitness', undefined)

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME / POLLING — suivi du statut de génération
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
