import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { etatSeance } from '../../../lib/retour'
import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { DUREES } from '../../../lib/durees'
import { getBands, getProfile, getSession, replaceExercise } from '../../../lib/renfo'
import { space } from '../../../styles/tokens'
import BarreAttente from '../../../ui/BarreAttente'
import Page from '../../../ui/Page'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { availableExercises } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import {
  blocDeContenu, editionDe, estNouveauFormat, exercicesProposes,
} from '../../../../supabase/functions/_shared/strength/compose.ts'
import ListeExercices from './ListeExercices'
import { sousLigneListe, titreListe, titreSectionListe } from './seance'

const charger = async (sessionId) => {
  const [session, profile, bands] = await Promise.all([getSession(sessionId), getProfile(), getBands()])
  return { session, profile, bands }
}

// Seule une séance à faire et au nouveau format se modifie.
const modifiable = (session) => session.status === 'planned' && estNouveauFormat(session.content)

/**
 * Route /renfo/session/:sessionId/remplacer/:blockIndex/:slug : la liste élargie
 * (lot R7, exercicesProposes), enregistrée tout de suite par replaceExercise.
 */
const RemplacerPage = () => {
  const { sessionId, blockIndex: brut, slug } = useParams()
  const blockIndex = Number(brut)
  const navigate = useAppNavigate()
  const location = useLocation()
  const pageSeance = `/renfo/session/${sessionId}`
  // État de la séance (son retour vers l'Historique), rendu après un replace.
  const etat = etatSeance(location)
  const cle = `${sessionId}/${brut}/${slug}`

  const [chargement, setChargement] = useState({ status: 'loading', cle, essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')
  const action = useAction({
    attente: "Remplacement de l'exercice",
    duree: DUREES.actionCourte,
    echec: "Le remplacement n'a pas abouti. Réessaie.",
  })

  // Le retour après le remplacement n'a lieu que si la page est encore montée.
  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  if (chargement.cle !== cle) setChargement({ status: 'loading', cle, essai: 0 })

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
        console.error('[renfo remplacer] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, cle, chargement.essai, navigate, etat])

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
  if (chargement.status !== 'ready') return null

  const { session, profile, bands } = chargement
  const available = availableExercises(profile?.equipment ?? [], bands.map((b) => b.kg))
  const bloc = blocDeContenu(session.content, blockIndex, slug)
  const edition = editionDe(session.content)
  const focus = typeof bloc === 'number' ? edition.supersets[bloc]?.focus : null
  const sections = bloc === null ? [] : exercicesProposes(edition, { bloc, slug }, available)
    .map((s) => ({ ...s, titre: titreSectionListe(s.cle, focus) }))

  const retour = () => {
    if (!montee.current) return
    if (location.key === 'default') navigate(pageSeance, { replace: true, direction: 'back', state: etat })
    else navigate(-1, { direction: 'back' })
  }

  const choisir = async (nouveau) => {
    const { ok } = await action.lancer(() => replaceExercise(session.id, blockIndex, slug, nouveau))
    if (!ok) return
    retour()
  }

  return (
    <Page gap={0}>
      <BarreAttente place="carte" {...action.barre} sx={{ '& .MuiCollapse-wrapperInner': { pb: space[12] } }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[24] }}>
        <ListeExercices
          titre={titreListe(slug)}
          sousLigne={bloc === null ? '' : sousLigneListe(bloc, focus)}
          sections={sections}
          onChoisir={choisir}
          desactive={action.enCours}
        />
      </Box>
    </Page>
  )
}

export default RemplacerPage
