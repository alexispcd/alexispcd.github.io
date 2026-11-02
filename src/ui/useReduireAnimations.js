import { useSyncExternalStore } from 'react'

// Réglage « Réduire les animations » de l'appareil, lu en JavaScript pour ce que le
// CSS ne couvre pas (chiffre qui défile). Le reste passe par
// @media (prefers-reduced-motion: reduce).
const QUERY = '(prefers-reduced-motion: reduce)'

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null)

const subscribe = (callback) => {
  const m = media()
  if (!m) return () => {}
  m.addEventListener('change', callback)
  return () => m.removeEventListener('change', callback)
}

const getSnapshot = () => media()?.matches ?? false

export const useReduireAnimations = () => useSyncExternalStore(subscribe, getSnapshot, () => false)
