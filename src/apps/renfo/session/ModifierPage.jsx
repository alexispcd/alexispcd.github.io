import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { etatSeance } from '../../../lib/retour'
import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { DUREES } from '../../../lib/durees'
import { getSession, updateSession } from '../../../lib/renfo'
import BarreAttente from '../../../ui/BarreAttente'
import Page from '../../../ui/Page'
import { useFinAttente } from '../../../ui/useFinAttente'
import {
  compositionDe, estNouveauFormat, planMiseAJour,
} from '../../../../supabase/functions/_shared/strength/compose.ts'
import { chargerDonnees } from '../compose/donnees'
import EditeurSeance from '../compose/EditeurSeance'

const charger = async (sessionId) => {
  const [session, donnees] = await Promise.all([getSession(sessionId), chargerDonnees()])
  return { session, donnees }
}

// Seule une séance à faire, hors cycle et au nouveau format se modifie.
const modifiable = (session) => session.status === 'planned' && session.cycle_id == null && estNouveauFormat(session.content)

// Sans exercice à faire choisir, l'enregistrement est rapide : pas de « Préparation ».
const ENREGISTREMENT = { titre: 'Enregistrement de ta séance', detail: null, duree: DUREES.enregistrement }

/** Route /renfo/session/:sessionId/modifier : la composition d'une séance à faire, reprise. */
const ModifierPage = () => {
  const { sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  const pageSeance = `/renfo/session/${sessionId}`
  // État de la séance (son retour vers l'Historique), rendu après un replace.
  const etat = etatSeance(location)

  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')

  // Le retour à la séance n'a lieu que si la page est encore montée.
  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  if (chargement.sessionId !== sessionId) setChargement({ status: 'loading', sessionId, essai: 0 })

  useEffect(() => {
    let annule = false
    charger(sessionId).then(
      (res) => {
        if (annule) return
        if (!modifiable(res.session)) {
          navigate(`/renfo/session/${sessionId}`, { replace: true, direction: 'back', state: etat })
          return
        }
        setChargement((c) => ({ ...c, status: 'ready', ...res }))
      },
      (e) => {
        console.error('[renfo modifier] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, chargement.essai, navigate, etat])

  const session = chargement.session
  const depart = useMemo(() => (session ? compositionDe(session.content) : null), [session])

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error') {
    return (
      <Page>
        <CarteSysteme
          titre="Séance introuvable"
          phrase="Elle n'a pas pu être chargée."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Page>
    )
  }
  if (chargement.status !== 'ready' || !depart) return null

  // La séance relit sa ligne au montage : retour par l'historique, sinon en replace.
  const retour = () => {
    if (!montee.current) return
    if (location.key === 'default') navigate(pageSeance, { replace: true, direction: 'back', state: etat })
    else navigate(-1, { direction: 'back' })
  }

  const attenteDe = (composition) => {
    const plan = planMiseAJour(session.content, composition)
    return plan.aGenerer.length || !plan.echauffementGarde ? undefined : ENREGISTREMENT
  }

  return (
    <EditeurSeance
      depart={depart}
      donnees={chargement.donnees}
      libelleEnvoi="Enregistrer"
      envoyer={(composition) => updateSession(session.id, composition)}
      onSession={retour}
      onInchange={retour}
      attenteDe={attenteDe}
      garde
    />
  )
}

export default ModifierPage
