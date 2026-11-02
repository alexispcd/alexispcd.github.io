import { callFunction } from './functions'

// Appels à l'Edge Function admin-users (rôle admin vérifié côté serveur). L'erreur
// garde son `status` (409 : e-mail déjà utilisé) ; un échec réseau est marqué
// `network` par callFunction.
const callAdmin = (body) => callFunction('admin-users', body)

export const listUsers = async () => (await callAdmin({ action: 'list' })).users
export const createUser = (email, modules) => callAdmin({ action: 'create', email, modules })
export const setUserModules = (userId, modules) => callAdmin({ action: 'set_modules', user_id: userId, modules })
export const disableUser = (userId) => callAdmin({ action: 'disable', user_id: userId })
export const enableUser = (userId) => callAdmin({ action: 'enable', user_id: userId })
export const deleteUser = (userId) => callAdmin({ action: 'delete', user_id: userId })
