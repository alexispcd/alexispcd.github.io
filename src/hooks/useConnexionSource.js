import { useRef, useState } from 'react'
import { useAction } from '../ui/useAction'
import { DUREES } from '../lib/durees'
import { lancerConnexion } from '../lib/sources'
import { nomSource } from '../../supabase/functions/_shared/sources/catalog.ts'

/**
 * Connexion d'une source depuis un écran : attente pendant l'appel start, puis le
 * navigateur part chez la marque. Échec du start : Message « La connexion à Coros
 * n'a pas abouti. Réessaie. » (ou « Pas de connexion, réessaie. »).
 * Renvoie { lancer(id, retour), enCours, barre } (barre : props de BarreAttente).
 */
export const useConnexionSource = () => {
  const [id, setId] = useState(null)
  // Lu à l'échec, dans le même appel que lancer : l'état n'est pas encore à jour.
  const idLance = useRef(null)
  const action = useAction({
    attente: `Connexion à ${nomSource(id)}`,
    duree: DUREES.sources,
    echec: () => `La connexion à ${nomSource(idLance.current)} n'a pas abouti. Réessaie.`,
  })
  const lancer = (source, retour) => {
    idLance.current = source
    setId(source)
    return action.lancer(() => lancerConnexion(source, retour))
  }
  return { lancer, enCours: action.enCours, barre: action.barre }
}
