// Transitions de page (View Transitions API via React Router). Sans
// document.startViewTransition, React Router navigue normalement, sans erreur.

const root = () => document.documentElement

const pathOf = (to) => {
  if (typeof to === 'string') return to.split(/[?#]/)[0]
  return to?.pathname ?? ''
}

export const pathDepth = (path) => path.split('/').filter(Boolean).length

// « back » pour un retour dans l'historique ou une cible moins profonde que la page
// courante, « forward » sinon. Un chemin relatif est traité comme une avance.
export const directionFor = (to, from = window.location.pathname) => {
  if (typeof to === 'number') return to < 0 ? 'back' : 'forward'
  const target = pathOf(to)
  if (!target.startsWith('/')) return 'forward'
  return pathDepth(target) < pathDepth(from) ? 'back' : 'forward'
}

// Toute navigation lancée par l'app réactive l'animation (data-vt-skip retiré).
export const setTransitionDirection = (direction) => {
  root().dataset.vtDir = direction
  delete root().dataset.vtSkip
}

// Sens d'un déplacement dans l'historique lancé par l'app (navigate(-1)), lu puis
// remis à zéro par le prochain popstate. Absent : le popstate vient du geste retour
// iOS ou du bouton du navigateur, qui animent déjà eux-mêmes.
let pendingAppPop = null

export const markAppHistoryNavigation = (direction) => {
  pendingAppPop = direction
}

const onPopState = () => {
  if (pendingAppPop) setTransitionDirection(pendingAppPop)
  else root().dataset.vtSkip = ''
  pendingAppPop = null
}

// Enregistré à l'évaluation du module, donc avant le listener popstate du router
// (createBrowserRouter dans App.jsx, qui dépend de ce module) : data-vt-skip est posé
// avant que React Router ne traite le popstate.
window.addEventListener('popstate', onPopState)

// Ancien réglage de test (style au choix), plus lu : on efface la valeur mémorisée.
try {
  localStorage.removeItem('cairn-vt-style')
} catch {
  // Stockage indisponible : rien à nettoyer.
}
