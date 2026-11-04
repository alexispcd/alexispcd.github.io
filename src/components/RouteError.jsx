import { useEffect } from 'react'
import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { useAppNavigate } from '../hooks/useAppNavigate'
import EcranSysteme from './EcranSysteme'

// Messages des navigateurs quand un chunk lazy est introuvable, typiquement après
// un nouveau déploiement qui a supprimé l'ancien hash de GitHub Pages.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

const recharger = () => window.location.reload()

const RouteError = () => {
  const error = useRouteError()
  const navigate = useAppNavigate()
  // URL inconnue ou module non attribué : recharger ne changerait rien, on renvoie à l'accueil.
  const isNotFound = isRouteErrorResponse(error) && error.status === 404
  const isChunkError = CHUNK_ERROR.test(error?.message ?? '')

  // Le détail part en console, jamais à l'écran.
  useEffect(() => {
    console.error('[RouteError]', error)
  }, [error])

  if (isNotFound) {
    return (
      <EcranSysteme
        titre="Page introuvable"
        phrase="Cette page n'existe pas ou n'est plus disponible."
        bouton="Retour à l'accueil"
        onClick={() => navigate('/')}
      />
    )
  }

  if (isChunkError) {
    return (
      <EcranSysteme
        titre="Nouvelle version disponible"
        phrase="Le Cairn a été mis à jour. Recharge pour continuer."
        bouton="Recharger"
        onClick={recharger}
      />
    )
  }

  return (
    <EcranSysteme
      titre="Cette page n'a pas pu s'afficher"
      phrase="Réessaie dans un instant."
      bouton="Réessayer"
      onClick={recharger}
    />
  )
}

export default RouteError
