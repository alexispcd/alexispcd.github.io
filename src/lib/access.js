import supabase from './supabase'

// Rôle et modules du compte connecté. Miroir de supabase/functions/_shared/access.ts.

/** Vrai si le compte a le module dans user_modules. Aucune exception pour le rôle admin. */
export const hasModule = (access, moduleId) =>
  access.modules.includes(moduleId)

/** Charge { userId, role, modules } depuis profiles et user_modules (RLS : sa propre ligne). */
export const fetchAccess = async (userId) => {
  const [profile, modules] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
    supabase.from('user_modules').select('module_id').eq('user_id', userId),
  ])
  if (profile.error) throw profile.error
  if (modules.error) throw modules.error
  return {
    userId,
    role: profile.data?.role === 'admin' ? 'admin' : 'user',
    modules: (modules.data ?? []).map(row => row.module_id),
  }
}

// Accès courant partagé avec les loaders de route : le router est créé une seule
// fois hors de React, il lit ici l'accès publié par App.
let current = null
let waiters = []

export const publishAccess = (access) => {
  current = access
  waiters.forEach(resolve => resolve(access))
  waiters = []
}

export const clearAccess = () => {
  current = null
}

/** Résout dès qu'un accès est publié (immédiatement s'il l'est déjà). */
export const whenAccessReady = () =>
  current ? Promise.resolve(current) : new Promise(resolve => waiters.push(resolve))
