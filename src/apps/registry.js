import { data } from 'react-router-dom'
import { hasModule, whenAccessReady } from '../lib/access'
import cotes from './cotes/module'
import training from './training/module'
import renfo from './renfo/module'
import revisions from './revisions/module'
import veille from './veille/module'
import admin from './admin/module'
// Atelier : page temporaire de la refonte, retirée à la fin (lot F1).
import atelier from './atelier/module'
import compte from './compte/module'

// Registre unique des modules : routes et home en dérivent. Aucun module n'est
// désactivé dans le code : seuls les droits du compte (user_modules) décident de ce
// qui est visible et accessible, admin compris.
// Ajouter un module : créer src/apps/<id>/module.js puis l'ajouter ici. L'ordre du
// tableau est celui de la liste Modules de l'Accueil.
// Un module `commun` (page Compte) est ouvert à tous les comptes : il porte son propre
// canAccess, n'est jamais attribuable et n'apparaît pas sur l'Accueil.
export const modules = [training, renfo, cotes, revisions, veille, admin, atelier, compte]

/**
 * Accès d'un compte à un module : le canAccess du descripteur s'il en a un, sinon
 * un module adminOnly est réservé au rôle admin et les autres passent par user_modules.
 */
export const canAccess = (module, access) => {
  if (module.canAccess) return module.canAccess(access)
  return module.adminOnly ? access.role === 'admin' : hasModule(access, module.id)
}

/** Modules qu'un admin peut attribuer à un compte, y compris le sien. */
export const assignableModules = () => modules.filter(m => !m.adminOnly && !m.commun)

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

/** Modules de la liste de l'Accueil pour cet accès, à plat, dans l'ordre du registre. */
export const homeModules = (access) =>
  modules.filter(m => !m.adminOnly && !m.commun && canAccess(m, access))
