import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { etatSeance } from '../../../lib/retour'
import { Box } from '@mui/material'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import BarreAttente from '../../../ui/BarreAttente'
import PageRessenti from '../../../ui/PageRessenti'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import { emptyFeedback } from '../../../lib/feedback'
import { completeSession, getSession } from '../../../lib/renfo'
import { space } from '../../../styles/tokens'
import { effacerPosition } from '../player/position'

/** Page « Valider la séance » de Renfo : le ressenti seul, sans activité. */
const ValiderPage = () => {
  const { sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  const pageSeance = `/renfo/session/${sessionId}`
  // État de la séance (son retour vers l'Historique), rendu après un replace.
  const etat = etatSeance(location)

  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const [ressenti, setRessenti] = useState(emptyFeedback)
  const attente = useFinAttente(chargement.status === 'loading')
  const action = useAction({
    attente: 'Validation de ta séance',
    duree: DUREES.actionCourte,
    echec: 'La validation n\'a pas abouti. Réessaie.',
  })

  // Le retour après la validation n'a lieu que si la page est encore montée : un
  // chevron touché pendant l'attente a déjà ramené à la séance.
  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  // Changement de séance : tout repart au rendu, l'effet ne fait que charger.
  if (chargement.sessionId !== sessionId) {
    setChargement({ status: 'loading', sessionId, essai: 0 })
    setRessenti(emptyFeedback())
  }

  useEffect(() => {
    let annule = false
    getSession(sessionId).then(
      (s) => {
        if (annule) return
        if (s.status !== 'planned') {
          navigate(`/renfo/session/${sessionId}`, { replace: true, direction: 'back', state: etat })
          return
        }
        setChargement((c) => ({ ...c, status: 'ready', session: s }))
      },
      (e) => {
        console.error('[renfo valider] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, chargement.essai, navigate, etat])

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error') {
    return (
      <Box sx={{ px: space[16], pt: `calc(${HEADER_HEIGHT}px + ${space[8]})` }}>
        <CarteSysteme
          titre="Séance introuvable"
          phrase="Elle n'a pas pu être chargée."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Box>
    )
  }
  if (chargement.status !== 'ready') return null

  const { session } = chargement

  const retour = () => {
    if (!montee.current) return
    if (location.key === 'default') navigate(pageSeance, { replace: true, direction: 'back', state: etat })
    else navigate(-1, { direction: 'back' })
  }

  const valider = async (feedback) => {
    // Élastiques joués d'une ancienne séance réinitialisée : gardés tels quels.
    const { ok } = await action.lancer(() => completeSession(session.id, { bandsUsed: session.bands_used, feedback }))
    if (!ok) return
    effacerPosition(session.id)
    retour()
  }

  return (
    <PageRessenti
      contexte={session.title}
      valeur={ressenti}
      onChange={setRessenti}
      onValider={valider}
      action={action}
    />
  )
}

export default ValiderPage
