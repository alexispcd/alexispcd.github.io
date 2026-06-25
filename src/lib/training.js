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
