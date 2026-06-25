import supabase from './supabase'

export const getActivePlan = async () => {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

export const getPlanSessions = async (planId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('plan_id', planId)
    .order('week_number', { ascending: true })
    .order('zone', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const getPlanHistory = async () => {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .in('status', ['completed', 'archived'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const generatePlan = async (context) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-plan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ context }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Erreur serveur (${res.status})`)
  }

  return res.json() // { planId, status }
}

export const markSessionDone = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({ status: 'faite', completed_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const resetSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({ status: 'à_venir', completed_at: null, coros_label_id: null })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const skipSession = async (sessionId) => {
  const { data, error } = await supabase
    .from('training_sessions')
    .update({ status: 'sautée' })
    .eq('id', sessionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const unskipSession = async (sessionId) => {
  // 1. Remettre la séance sautée à venir
  const { data: restored, error: unskipErr } = await supabase
    .from('training_sessions')
    .update({ status: 'à_venir' })
    .eq('id', sessionId)
    .select()
    .single()
  if (unskipErr) throw unskipErr

  // 2. Trouver toutes les séances adaptées à cause de ce saut
  const { data: adapted, error: findErr } = await supabase
    .from('training_sessions')
    .select('id, previous_details')
    .eq('adapted_by_session_id', sessionId)
  if (findErr) throw findErr

  // 3. Restaurer chaque séance adaptée depuis previous_details
  if (adapted?.length) {
    await Promise.all(adapted.map(s =>
      supabase
        .from('training_sessions')
        .update({
          details: s.previous_details,
          previous_details: null,
          status: 'à_venir',
          adapted_at: null,
          adapted_by_session_id: null,
        })
        .eq('id', s.id)
    ))
  }

  return restored
}

export const adaptSessions = async (planId, skippedSessionId) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/adapt-sessions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ planId, skippedSessionId }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Erreur adaptation (${res.status})`)
  }

  return res.json() // { adaptedCount: N }
}

export const subscribeToPlan = (planId, callback) => {
  // Polling toutes les 4s (fallback si Realtime non activé)
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

  // Realtime subscription (prend le relais si activé)
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
