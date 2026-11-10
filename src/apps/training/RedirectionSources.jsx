import { Navigate, useLocation } from 'react-router-dom'

// Ancienne adresse des réglages Training : la connexion des sources vit désormais
// sur /compte/sources. La query est gardée (retour d'une ancienne connexion).
const RedirectionSources = () => {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/compte/sources', search }} replace />
}

export default RedirectionSources
