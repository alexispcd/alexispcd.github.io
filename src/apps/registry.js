import { data } from 'react-router-dom'
import { hasModule, whenAccessReady } from '../lib/access'
import cotes from './cotes/module'
import training from './training/module'
import renfo from './renfo/module'
import revisions from './revisions/module'
import veille from './veille/module'
import admin from './admin/module'

// Registre unique des modules : routes et home en dérivent. Aucun module n'est
// désactivé dans le code : seuls les droits du compte (user_modules) décident de ce
// qui est visible et accessible, admin compris.
// Ajouter un module : créer src/apps/<id>/module.js puis l'ajouter ici.
export const modules = [cotes, training, renfo, revisions, veille, admin]

export const categoryOrder = ['Sport', 'Études', 'Dev']

/** Accès d'un compte à un module : un module adminOnly est réservé au rôle admin. */
export const canAccess = (module, access) =>
  module.adminOnly ? access.role === 'admin' : hasModule(access, module.id)

/** Modules qu'un admin peut attribuer à un compte, y compris le sien. */
export const assignableModules = () => modules.filter(m => !m.adminOnly)

// Routes React Router de tous les modules. Le loader attend l'accès publié par App
// et lève un 404 si le compte n'a pas le module : la route aboutit au « Page
// introuvable » de RouteError sans jamais rendre la page. La page est un chunk
// chargé à la demande (lazy) : la page courante reste affichée pendant le chargement.
export const moduleRoutes = () => modules.flatMap(m =>
  m.routes.map(({ path, load, handle }) => ({
    path,
    handle,
    loader: async () => {
      if (!canAccess(m, await whenAccessReady())) throw data(null, { status: 404 })
      return null
    },
    lazy: { Component: async () => (await load()).default },
  })),
)

// Modules visibles sur la home pour cet accès, groupés par catégorie dans l'ordre
// de categoryOrder. Les modules adminOnly n'y apparaissent jamais, les catégories
// vides sont omises.
export const homeCategories = (access) => {
  const visible = modules.filter(m => !m.adminOnly && canAccess(m, access))
  return categoryOrder
    .map(label => ({ label, modules: visible.filter(m => m.category === label) }))
    .filter(cat => cat.modules.length > 0)
}
