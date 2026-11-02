import supabase from './supabase'
import { PAS_DE_CONNEXION, estErreurReseau } from './reseau'

// Échec réseau : message unique, marqué `network`, cause d'origine gardée pour la console.
const erreurReseau = (cause) => Object.assign(new Error(PAS_DE_CONNEXION, { cause }), { network: true })

// Appel d'une Edge Function avec le jeton de la session courante. Erreur levée
// avec le message lisible renvoyé par la fonction (`detail` ou `error`), le
// statut HTTP et le corps complet (`code`, `details`...). Sans réseau : erreur
// `network` avec PAS_DE_CONNEXION (src/lib/reseau.js).
export const callFunction = async (name, body) => {
  // Hors ligne, getSession avec une session expirée tente un rafraîchissement qui
  // peut durer 25 s (mesuré sous Node) : on s'arrête tout de suite.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw erreurReseau()

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError && estErreurReseau(sessionError)) throw erreurReseau(sessionError)
  if (!session) throw new Error('Non authentifié')

  let res
  try {
    res = await fetch(
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
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw erreurReseau(e)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = new Error(err.detail ?? err.error ?? `Erreur serveur (${res.status})`)
    error.status = res.status
    error.body = err
    throw error
  }
  return res.json()
}
