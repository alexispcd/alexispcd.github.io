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

export const setTransitionDirection = (direction) => {
  root().dataset.vtDir = direction
}

// Bouton retour du navigateur ou geste système : toujours un retour.
export const initTransitions = () => {
  window.addEventListener('popstate', () => setTransitionDirection('back'))
  applyTransitionStyle(readTransitionStyle())
}

// --- Réglage de test, à retirer une fois le style choisi ---
// Choix du style (data-vt-style sur <html>, CSS dans index.css), mémorisé par appareil.

export const VT_STYLES = [
  { id: 'slide', label: 'Glissement' },
  { id: 'fade', label: 'Fondu' },
  { id: 'fade-zoom', label: 'Fondu et zoom' },
  { id: 'none', label: 'Aucune' },
]

const VT_STYLE_KEY = 'cairn-vt-style'
const DEFAULT_VT_STYLE = 'slide'

export const readTransitionStyle = () => {
  try {
    const stored = localStorage.getItem(VT_STYLE_KEY)
    return VT_STYLES.some(s => s.id === stored) ? stored : DEFAULT_VT_STYLE
  } catch {
    return DEFAULT_VT_STYLE
  }
}

export const applyTransitionStyle = (style) => {
  root().dataset.vtStyle = style
}

export const saveTransitionStyle = (style) => {
  applyTransitionStyle(style)
  try {
    localStorage.setItem(VT_STYLE_KEY, style)
  } catch {
    // Stockage indisponible : le style vaut pour cette session seulement.
  }
}
// --- Fin du réglage de test ---
