import supabase from './supabase'
import { callFunction } from './functions'

// Sources de données (montres, applis de sport) : état, connexion, déconnexion.
// Chaque source a sa fonction OAuth `${id}-oauth` (coros-oauth seule aujourd'hui).
// Le nom, le logo et les capacités viennent du catalogue commun
// (supabase/functions/_shared/sources/catalog.ts).

const fonctionOauth = (id) => `${id}-oauth`

/**
 * État des connexions du compte. -> [{ id, etat: 'connectee' | 'expiree' }]
 * La fonction de Coros répond pour toutes les sources du compte.
 */
export const getStatutSources = async () => {
  const res = await callFunction(fonctionOauth('coros'), { action: 'status' })
  return Array.isArray(res?.sources) ? res.sources : []
}

/**
 * Lance la connexion d'une source : la fonction prépare l'autorisation et garde
 * `retour` (chemin de l'app où revenir), puis le navigateur part chez la marque.
 * Le retour arrive avec ?source=<id>&connexion=ok|echec (useRetourConnexion).
 */
export const lancerConnexion = async (id, retour) => {
  const { url } = await callFunction(fonctionOauth(id), { action: 'start', retour })
  if (typeof url !== 'string' || !url) throw new Error('URL d\'autorisation absente')
  window.location.href = url
}

/** Déconnecte une source (suppression locale des jetons, le compte de la marque n'est pas modifié). */
export const deconnecterSource = (id) => callFunction(fonctionOauth(id), { action: 'disconnect' })

/** Noms des plans en cours qui utilisent la source (training_plans actifs du compte). */
export const getPlansDeSource = async (id) => {
  const { data, error } = await supabase
    .from('training_plans')
    .select('race_name')
    .eq('source', id)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []).map((p) => p.race_name).filter(Boolean)
}
