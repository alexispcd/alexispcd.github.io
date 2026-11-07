import { useEffect, useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import CarteSysteme from '../../components/CarteSysteme'
import { useAppCtx } from '../../lib/context'
import { DUREES } from '../../lib/durees'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { space } from '../../styles/tokens'
import BarreAttente from '../../ui/BarreAttente'
import Bouton from '../../ui/Bouton'
import Page from '../../ui/Page'
import { useFinAttente } from '../../ui/useFinAttente'
import { compositionDe, titreSeance } from '../../../supabase/functions/_shared/strength/compose.ts'
import { ligneHistorique, phraseEnAttente, phraseSuggestion, semaineEnCours } from './accueil'
import { chargerDonnees } from './compose/donnees'
import { todayISO } from './dates'
import LigneHistorique from './home/LigneHistorique'
import ProchaineSeance from './home/ProchaineSeance'
import SemaineCarte from './home/SemaineCarte'
import { suggestionDe } from './suggestion'

/** Accueil Renfo : la semaine en cours et la prochaine séance. */
const RenfoHome = () => {
  const navigate = useAppNavigate()
  const { setHeaderActions } = useAppCtx()
  const [chargement, setChargement] = useState({ status: 'loading', essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')

  useEffect(() => {
    let annule = false
    chargerDonnees().then(
      (donnees) => { if (!annule) setChargement((c) => ({ ...c, status: 'ready', donnees })) },
      (err) => {
        console.error('[renfo home]', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [chargement.essai])

  useEffect(() => {
    setHeaderActions([
      { label: 'Réglages', onClick: () => navigate('/renfo/settings', { direction: 'forward' }) },
    ])
    return () => setHeaderActions([])
  }, [navigate, setHeaderActions])

  const donnees = chargement.donnees
  const today = todayISO()
  const suggestion = useMemo(() => (donnees ? suggestionDe(donnees) : null), [donnees])

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
  if (chargement.status !== 'ready') return null

  const { profile, done, pending, bands, bases } = donnees
  if (!profile) {
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

  const objectif = profile.frequency ?? 1
  const semaine = semaineEnCours(done, today, objectif)
  const composer = (depart) => navigate('/renfo/composer', {
    direction: 'forward',
    state: { depart, donnees: { profile, bands, done, bases } },
  })

  return (
    <Page gap={space[24]}>
      <SemaineCarte semaine={semaine} objectif={objectif} today={today} />

      {pending ? (
        <ProchaineSeance
          phrase={phraseEnAttente(pending)}
          titre={pending.title}
          composition={compositionDe(pending.content)}
        >
          <Bouton pleineLargeur onClick={() => navigate(`/renfo/session/${pending.id}`, { direction: 'forward' })}>
            Reprendre
          </Bouton>
        </ProchaineSeance>
      ) : suggestion && suggestion.supersets.length > 0 ? (
        <ProchaineSeance
          phrase={phraseSuggestion(suggestion, done)}
          titre={titreSeance(suggestion.supersets.map((s) => s.focus))}
          composition={suggestion}
        >
          <Bouton pleineLargeur onClick={() => composer('suggestion')}>Créer cette séance</Bouton>
          <Bouton variante="texte" petit pleineLargeur onClick={() => composer('vide')}>Composer autrement</Bouton>
        </ProchaineSeance>
      ) : null}

      <LigneHistorique
        sousLigne={ligneHistorique(done, today)}
        onClick={() => navigate('/historique', { direction: 'forward', state: { retour: '/renfo' } })}
      />
    </Page>
  )
}

export default RenfoHome
