import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMessage } from '../ui/useMessage'
import { lireRetourConnexion } from '../lib/retourConnexion'
import { nomSource } from '../../supabase/functions/_shared/sources/catalog.ts'

/**
 * Retour d'une connexion OAuth, sur n'importe quelle page : lit source et connexion
 * dans l'URL, les retire (replace, sans transition, état de la page gardé), puis dit
 * l'échec en Message. Réussite : aucun message, la page montre déjà la source.
 * Monté une seule fois, dans la coque (AppLayout de src/App.jsx).
 */
export const useRetourConnexion = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { afficher } = useMessage()

  useEffect(() => {
    const retour = lireRetourConnexion(location.search)
    if (!retour) return
    navigate(
      { pathname: location.pathname, search: retour.search, hash: location.hash },
      { replace: true, state: location.state },
    )
    if (!retour.ok) afficher(`La connexion à ${nomSource(retour.source)} n'a pas abouti. Réessaie.`)
  }, [location, navigate, afficher])
}
