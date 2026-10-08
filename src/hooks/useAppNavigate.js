import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { directionFor, setTransitionDirection } from '../lib/viewTransition'

// useNavigate avec transition de page. Option `direction` ('forward' | 'back') pour
// forcer le sens quand la profondeur du chemin ne suffit pas à le déduire.
// navigate(-1) n'accepte pas d'options : React Router anime ce retour seulement si
// l'avance correspondante a été faite avec une transition.
export const useAppNavigate = () => {
  const navigate = useNavigate()
  return useCallback((to, { direction, ...options } = {}) => {
    setTransitionDirection(direction ?? directionFor(to))
    if (typeof to === 'number') return navigate(to)
    return navigate(to, { viewTransition: true, ...options })
  }, [navigate])
}
