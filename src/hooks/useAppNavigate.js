import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { directionFor, setTransitionDirection, markAppHistoryNavigation } from '../lib/viewTransition'

// useNavigate avec transition de page. Option `direction` ('forward' | 'back') pour
// forcer le sens quand la profondeur du chemin ne suffit pas à le déduire.
// navigate(-1) n'accepte pas d'options : React Router anime ce retour seulement si
// l'avance correspondante a été faite avec une transition. Le popstate qui suit est
// marqué comme venant de l'app pour ne pas être traité comme un geste système.
export const useAppNavigate = () => {
  const navigate = useNavigate()
  return useCallback((to, { direction, ...options } = {}) => {
    const dir = direction ?? directionFor(to)
    setTransitionDirection(dir)
    if (typeof to === 'number') {
      markAppHistoryNavigation(dir)
      return navigate(to)
    }
    markAppHistoryNavigation(null)
    return navigate(to, { viewTransition: true, ...options })
  }, [navigate])
}
