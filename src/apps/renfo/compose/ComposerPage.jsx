import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { DUREES } from '../../../lib/durees'
import { createSession } from '../../../lib/renfo'
import BarreAttente from '../../../ui/BarreAttente'
import Page from '../../../ui/Page'
import { useFinAttente } from '../../../ui/useFinAttente'
import { availableExercises } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { preremplir } from '../../../../supabase/functions/_shared/strength/compose.ts'
import { chargerDonnees } from './donnees'
import EditeurSeance from './EditeurSeance'

const departDe = (mode, donnees) => {
  if (mode === 'vide') return { intensity: null, supersets: [] }
  const available = availableExercises(donnees.profile?.equipment ?? [], donnees.bands.map((b) => b.kg))
  return preremplir({ intensity: 'normale', sessions: donnees.done, available })
}

/** Route /renfo/composer : nouvelle séance, préremplie depuis la suggestion ou vide. */
const ComposerPage = () => {
  const location = useLocation()
  const navigate = useAppNavigate()
  const recu = location.state?.donnees ? location.state : null
  const [chargement, setChargement] = useState(() => (recu
    ? { status: 'ready', donnees: recu.donnees, mode: recu.depart === 'vide' ? 'vide' : 'suggestion', essai: 0 }
    : { status: 'loading', mode: 'suggestion', essai: 0 }))
  const attente = useFinAttente(chargement.status === 'loading')

  // Page rechargée : on relit tout ; une séance déjà à faire s'ouvre à la place.
  useEffect(() => {
    if (chargement.status !== 'loading') return undefined
    let annule = false
    chargerDonnees().then(
      (donnees) => {
        if (annule) return
        if (donnees.pending) {
          navigate(`/renfo/session/${donnees.pending.id}`, { replace: true, direction: 'forward' })
          return
        }
        setChargement((c) => ({ ...c, status: 'ready', donnees }))
      },
      (err) => {
        console.error('[renfo composer] chargement :', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [chargement.status, chargement.essai, navigate])

  const depart = useMemo(
    () => (chargement.donnees ? departDe(chargement.mode, chargement.donnees) : null),
    [chargement.donnees, chargement.mode],
  )

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
          titre="Impossible de charger Renfo"
          phrase="Les données n'ont pas pu être chargées."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Page>
    )
  }
  if (chargement.status !== 'ready' || !depart) return null
  if (!chargement.donnees.profile) {
    return (
      <Page>
        <CarteSysteme
          titre="Règle ton matériel et ton objectif"
          phrase="Barre, chaise, élastiques et nombre de séances par semaine."
          bouton="Ouvrir les réglages"
          onClick={() => navigate('/renfo/settings', { direction: 'forward' })}
        />
      </Page>
    )
  }

  return (
    <EditeurSeance
      depart={depart}
      donnees={chargement.donnees}
      libelleEnvoi="Créer la séance"
      envoyer={createSession}
      onEnAttente={(err) => (err?.status === 409 && err.body?.code === 'seance_en_attente' ? err.body.session?.id ?? null : null)}
      onSession={(session) => navigate(`/renfo/session/${session.id}`, { replace: true, direction: 'forward' })}
    />
  )
}

export default ComposerPage
