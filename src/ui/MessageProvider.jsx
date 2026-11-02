import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Portal } from '@mui/material'
import { SPACE_BAS, space } from '../styles/tokens'
import { DURATION } from '../styles/motion'
import { MessageCtx } from './useMessage'
import { useReduireAnimations } from './useReduireAnimations'
import Message from './Message'

const DUREE_MESSAGE = 4000

/**
 * Fournit useMessage et useBarreBasMessage, et affiche le Message en bas de l'écran :
 * à SPACE_BAS du bas, ou 12 px au-dessus d'une barre du bas signalée. Un seul à la
 * fois : le message de 4 s passe devant le message fixe, qui revient ensuite.
 * Portail en zIndex 1250 : au-dessus de la barre du haut (1200), sous le voile
 * des feuilles et dialogues (1300).
 */
const MessageProvider = ({ children }) => {
  const reduire = useReduireAnimations()
  const [court, setCourt] = useState(null)
  const [fixe, setFixe] = useState(null)
  const [barreBas, setBarreBas] = useState(null)
  const minuteur = useRef(null)
  const compteur = useRef(0)

  const fermerCourt = useCallback(() => {
    clearTimeout(minuteur.current)
    setCourt(null)
  }, [])

  const afficher = useCallback((texte) => {
    clearTimeout(minuteur.current)
    compteur.current += 1
    setCourt({ id: compteur.current, texte })
    minuteur.current = setTimeout(() => setCourt(null), DUREE_MESSAGE)
  }, [])

  const afficherFixe = useCallback(({ texte, action, onFermer }) => {
    compteur.current += 1
    setFixe({ id: compteur.current, texte, action, onFermer })
  }, [])

  const retirerFixe = useCallback(() => setFixe(null), [])

  useEffect(() => () => clearTimeout(minuteur.current), [])

  const valeur = useMemo(
    () => ({ afficher, afficherFixe, retirerFixe, signalerBarreBas: setBarreBas }),
    [afficher, afficherFixe, retirerFixe],
  )

  // Message à l'écran, gardé pendant son départ.
  const cible = court ?? fixe
  const [affiche, setAffiche] = useState(cible)
  const [sortant, setSortant] = useState(false)
  const [cibleAvant, setCibleAvant] = useState(cible)
  if (cible !== cibleAvant) {
    setCibleAvant(cible)
    if (cible) {
      setAffiche(cible)
      setSortant(false)
    } else if (affiche) {
      setSortant(true)
    }
  }

  useEffect(() => {
    if (!sortant) return undefined
    const t = setTimeout(() => {
      setAffiche(null)
      setSortant(false)
    }, reduire ? 0 : DURATION.close)
    return () => clearTimeout(t)
  }, [sortant, reduire])

  const estFixe = affiche && affiche === fixe
  const fermer = () => {
    if (!affiche) return
    if (affiche === court) {
      fermerCourt()
      return
    }
    setFixe(null)
    affiche.onFermer?.()
  }
  const action = affiche?.action && {
    libelle: affiche.action.libelle,
    onClick: () => {
      if (estFixe) setFixe(null)
      affiche.action.onClick?.()
    },
  }

  return (
    <MessageCtx.Provider value={valeur}>
      {children}
      <Portal>
        <Box
          role="status"
          sx={{
            position: 'fixed',
            left: space[16],
            right: space[16],
            bottom: barreBas == null ? SPACE_BAS : `calc(${barreBas}px + ${space[12]})`,
            zIndex: 1250,
            pointerEvents: 'none',
          }}
        >
          {affiche && (
            <Message
              key={affiche.id}
              texte={affiche.texte}
              action={action}
              onFermer={fermer}
              sortant={sortant}
            />
          )}
        </Box>
      </Portal>
    </MessageCtx.Provider>
  )
}

export default MessageProvider
