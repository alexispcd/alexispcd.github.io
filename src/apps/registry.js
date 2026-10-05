import cotes from './cotes/module'
import training from './training/module'
import revisions from './revisions/module'
import veille from './veille/module'

// Registre unique des modules : routes et home en dérivent.
// Ajouter un module : créer src/apps/<id>/module.js puis l'ajouter ici.
export const modules = [cotes, training, revisions, veille]

export const categoryOrder = ['Sport', 'Études', 'Dev']

export const enabledModules = () => modules.filter(m => m.enabled)

// Routes React Router des modules activés. Chaque page est un chunk chargé à la
// demande via `lazy` : la page courante reste affichée pendant le chargement.
export const enabledRoutes = () => enabledModules().flatMap(m =>
  m.routes.map(({ path, load, handle }) => ({
    path,
    handle,
    lazy: async () => ({ Component: (await load()).default }),
  })),
)

// Modules activés groupés par catégorie, dans l'ordre de categoryOrder.
// Les catégories sans module activé sont omises.
export const enabledByCategory = () => categoryOrder
  .map(label => ({ label, modules: enabledModules().filter(m => m.category === label) }))
  .filter(cat => cat.modules.length > 0)
