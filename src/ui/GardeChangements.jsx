import { useCallback, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import FeuilleFlottante from './FeuilleFlottante'

/**
 * Garde des changements pas enregistrés : quitter la page (chevron, geste retour,
 * toute navigation vers un autre chemin) ouvre une confirmation tant que `actif`
 * est vrai. Composant plutôt que hook : il se monte dans le dernier return d'une
 * page, sans contrainte sur les retours anticipés.
 * - titre : la phrase qui explique ; action : la ligne qui quitte ; second bloc « Rester ».
 * Un seul blocage par routeur : pas de garde sur une page qui en a déjà un (player Renfo).
 */
const GardeChangements = ({
  actif,
  titre = 'Tes changements ne sont pas enregistrés.',
  action = 'Quitter sans enregistrer',
}) => {
  const doitBloquer = useCallback(
    ({ currentLocation, nextLocation }) => Boolean(actif) && nextLocation.pathname !== currentLocation.pathname,
    [actif],
  )
  const blocker = useBlocker(doitBloquer)
  const bloque = blocker.state === 'blocked'

  // Plus rien à garder pendant un blocage (enregistrement fini) : la navigation reste annulée.
  useEffect(() => {
    if (bloque && !actif) blocker.reset()
  }, [bloque, actif, blocker])

  const rester = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }

  // sansFermer : onFermer (rester) remettrait le blocker à zéro, et proceed n'existe
  // plus après un reset (même montage que RenfoPlayer.jsx).
  const quitter = () => {
    if (blocker.state === 'blocked') blocker.proceed()
  }

  return (
    <FeuilleFlottante
      ouverte={bloque}
      onFermer={rester}
      titre={titre}
      lignes={[{ libelle: action, onClick: quitter, sansFermer: true }]}
      fermerLibelle="Rester"
    />
  )
}

export default GardeChangements
