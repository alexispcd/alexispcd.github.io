import { isAuthRetryableFetchError } from '@supabase/supabase-js'

/** Seul message affiché pour un échec réseau, quelle que soit l'action. */
export const PAS_DE_CONNEXION = 'Pas de connexion, réessaie.'

// Messages d'un fetch qui n'a pas abouti : Safari « Load failed », Chrome « Failed to
// fetch », Firefox « NetworkError when attempting to fetch resource », Node « fetch failed ».
const MOTIFS = ['load failed', 'failed to fetch', 'networkerror', 'fetch failed']

/**
 * Vrai si l'erreur vient du réseau et non du serveur :
 * - erreur marquée `network` (callFunction) ;
 * - erreur d'auth Supabase qu'on peut retenter (AuthRetryableFetchError) ;
 * - TypeError d'un fetch, ou erreur de postgrest-js (`code` vide) qui l'enveloppe,
 *   par exemple { message: 'TypeError: fetch failed', details, hint: '', code: '' }.
 */
export const estErreurReseau = (e) => {
  if (!e || typeof e !== 'object') return false
  if (e.network === true) return true
  if (isAuthRetryableFetchError(e)) return true
  if (!(e instanceof TypeError) && e.code !== '') return false
  const message = String(e.message ?? '').toLowerCase()
  return MOTIFS.some((m) => message.includes(m))
}

/**
 * Texte à afficher pour un échec : PAS_DE_CONNEXION si l'erreur vient du réseau,
 * sinon `phrase` (écrite à la main, tutoyée). Le détail part en console, jamais à
 * l'écran : aucun e.message affiché.
 */
export const texteErreur = (e, phrase) => {
  console.error(e)
  return estErreurReseau(e) ? PAS_DE_CONNEXION : phrase
}
