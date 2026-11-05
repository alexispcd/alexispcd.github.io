import supabase from './supabase'
import { hasModule } from './access'

// Données de l'Historique des séances : seulement ce que le compte a comme modules,
// tout d'un coup (aucune pagination). Lectures filtrées par la RLS.

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data ?? []
}

const lireTraining = () => Promise.all([
  supabase
    .from('training_plans')
    .select('id, race_name, race_date, start_date, race_distance_m, goal_time_sec, race_time_sec, status, generation_status')
    .eq('generation_status', 'ready')
    .then(unwrap),
  // `type` en plus : la couleur d'une séance dit son intensité, dérivée du type.
  supabase
    .from('training_sessions')
    .select('id, plan_id, title, status, type, zone, completed_at, scheduled_date, actual_laps, rpe, verdict:analysis->>verdict')
    .in('status', ['done', 'skipped'])
    .then(unwrap),
])

const lireRenfo = () => supabase
  .from('strength_sessions')
  .select('id, title, completed_at, rpe, estimated_min:content->>estimated_min')
  .eq('status', 'done')
  .then(unwrap)

/** → { plans, seances, renfo }, listes vides pour un module que le compte n'a pas. */
export const getHistorique = async (access) => {
  const [training, renfo] = await Promise.all([
    hasModule(access, 'training') ? lireTraining() : [[], []],
    hasModule(access, 'renfo') ? lireRenfo() : [],
  ])
  const [plans, seances] = training
  return { plans, seances, renfo }
}
