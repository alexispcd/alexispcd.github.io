import supabase from './supabase'

// Appel d'une Edge Function avec le jeton de la session courante. Erreur levée
// avec le message lisible renvoyé par la fonction (`detail` ou `error`), le
// statut HTTP et le corps complet (`code`, `details`...).
export const callFunction = async (name, body) => {
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
