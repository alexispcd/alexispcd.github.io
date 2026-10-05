import supabase from './supabase'

// Appels à l'Edge Function admin-users (rôle admin vérifié côté serveur).
const callAdmin = async (body) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error ?? `Erreur serveur (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}

export const listUsers = async () => (await callAdmin({ action: 'list' })).users
export const createUser = (email, modules) => callAdmin({ action: 'create', email, modules })
export const setUserModules = (userId, modules) => callAdmin({ action: 'set_modules', user_id: userId, modules })
export const disableUser = (userId) => callAdmin({ action: 'disable', user_id: userId })
export const enableUser = (userId) => callAdmin({ action: 'enable', user_id: userId })
export const deleteUser = (userId) => callAdmin({ action: 'delete', user_id: userId })
