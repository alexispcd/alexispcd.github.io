import FullScreenLoader from './FullScreenLoader'
import EcranSysteme from './EcranSysteme'
import { useAppCtx } from '../lib/context'

// Bloque l'app tant que les droits du compte connecté ne sont pas chargés :
// évite une home vide ou une route refusée à tort pendant le chargement.
const AccessGate = ({ children }) => {
  const { access } = useAppCtx()

  if (!access) return <FullScreenLoader />

  if (access.error) {
    return (
      <EcranSysteme
        titre="Tes accès n'ont pas pu être chargés"
        phrase="Vérifie ta connexion, puis réessaie."
        bouton="Réessayer"
        onClick={() => window.location.reload()}
      />
    )
  }

  return children
}

export default AccessGate
