import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import CarteSysteme from '../../components/CarteSysteme'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAppCtx } from '../../lib/context'
import { DUREES } from '../../lib/durees'
import { getHistorique } from '../../lib/historique'
import { SPACE_BAS, border, radius, space } from '../../styles/tokens'
import BarreAttente from '../../ui/BarreAttente'
import Carte from '../../ui/Carte'
import MarqueSeance from '../../ui/MarqueSeance'
import { appuiLigne, focusContour } from '../../ui/appui'
import { useFinAttente } from '../../ui/useFinAttente'
import { todayISO } from '../training/constants'
import { construireFrise } from './frise'

// Position de la frise, gardée le temps d'un aller-retour vers une séance.
const CLE_POSITION = 'cairn-historique-scroll'

const lirePosition = () => {
  try {
    const valeur = Number(sessionStorage.getItem(CLE_POSITION))
    return Number.isFinite(valeur) ? valeur : 0
  } catch {
    return 0
  }
}
const ecrirePosition = (valeur) => {
  try {
    sessionStorage.setItem(CLE_POSITION, String(Math.round(valeur)))
  } catch {
    // Stockage indisponible (navigation privée) : la frise repartira en haut.
  }
}
const effacerPosition = () => {
  try {
    sessionStorage.removeItem(CLE_POSITION)
  } catch {
    // Rien à effacer.
  }
}

const GRILLE = { display: 'grid', gridTemplateColumns: '52px 10px minmax(0, 1fr)', columnGap: space[12] }
const COLONNE_RAIL = { display: 'flex', flexDirection: 'column', alignItems: 'center' }
const CORPS = { minWidth: 0, pb: space[14] }
const FILET = { display: 'block', height: border.filet, alignSelf: 'center', bgcolor: 'line', mb: space[14] }

// Rail de 2 px sous la marque, jusqu'à la ligne suivante ; coupé avant un mois et en bas.
const Rail = ({ fin }) => (
  <Box
    component="span"
    aria-hidden="true"
    sx={{ flex: '1 1 0', width: border.contour, minHeight: space[8], borderRadius: radius.pill, bgcolor: fin ? 'transparent' : 'line' }}
  />
)

const ColonneDate = ({ texte, aujourdhui }) => (
  <Typography
    variant="legende"
    component="span"
    sx={{ pt: '1px', fontVariantNumeric: 'tabular-nums', color: aujourdhui ? 'ink' : 'muted', fontWeight: aujourdhui ? 700 : 400 }}
  >
    {texte ?? ''}
  </Typography>
)

const MARQUE = {
  repos: { etat: 'aucune' },
  course: { etat: 'course' },
}

/** Contenu d'une séance ou du jalon de course : titre, chiffres, légende. */
const Texte = ({ e }) => (
  <>
    <Typography variant="corps-fort" component="span">{e.titre}</Typography>
    {e.chiffres && (
      <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{e.chiffres}</Typography>
    )}
    {e.legende && (
      <Typography variant="legende" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{e.legende}</Typography>
    )}
  </>
)

const Ligne = ({ e, onOuvrir }) => {
  if (e.type === 'mois') return null
  if (e.type === 'filet') {
    return (
      <Box sx={GRILLE}>
        <Box component="span" sx={FILET} />
        <Box component="span" sx={COLONNE_RAIL}><Rail fin={e.finRail} /></Box>
        <Box component="span" sx={FILET} />
      </Box>
    )
  }
  if (e.type === 'debut') {
    return (
      <Box sx={GRILLE}>
        <span />
        <Box component="span" sx={COLONNE_RAIL}><Rail fin={e.finRail} /></Box>
        <Box sx={CORPS}>
          <Typography variant="etiquette" component="span" sx={{ color: 'muted', textTransform: 'uppercase' }}>{e.texte}</Typography>
        </Box>
      </Box>
    )
  }
  const marque = e.type === 'seance' ? e.marque : MARQUE[e.type]
  return (
    <Box sx={GRILLE}>
      <ColonneDate texte={e.date} aujourdhui={e.aujourdhui} />
      <Box component="span" sx={{ ...COLONNE_RAIL, pt: space[4], gap: space[4] }}>
        <MarqueSeance etat={marque.etat} zone={marque.zone} />
        <Rail fin={e.finRail} />
      </Box>
      <Box sx={CORPS}>
        {e.type === 'repos' && (
          <Typography variant="secondaire" component="span" sx={{ display: 'block', color: 'muted' }}>Repos</Typography>
        )}
        {e.type === 'course' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}><Texte e={e} /></Box>
        )}
        {e.type === 'seance' && (
          <ButtonBase
            onClick={() => onOuvrir(e.lien)}
            sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: space[2],
              width: '100%', textAlign: 'left', color: 'ink', borderRadius: radius.inner,
              ...appuiLigne,
              // Le calque déborde un peu du texte, comme sur la planche.
              '&::after': { backgroundColor: 'var(--ink)', inset: '-4px -8px' },
              ...focusContour,
            }}
          >
            <Texte e={e} />
          </ButtonBase>
        )}
      </Box>
    </Box>
  )
}

/** Historique des séances : frise commune à la course et au Renfo. */
const HistoriquePage = () => {
  const { access } = useAppCtx()
  const navigate = useAppNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const [chargement, setChargement] = useState({ status: 'loading', essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')
  const defile = useRef(null)
  // Retour depuis une séance (chevron ou geste) : la frise reprend sa position.
  // Ouverte depuis Training ou Renfo : elle repart en haut.
  const [reprendre] = useState(() => Boolean(location.state?.reprise) || navigationType === 'POP')
  const repris = useRef(false)

  useEffect(() => {
    if (!reprendre) effacerPosition()
  }, [reprendre])

  useEffect(() => {
    let annule = false
    getHistorique(access).then(
      (donnees) => { if (!annule) setChargement((c) => ({ ...c, status: 'ready', donnees })) },
      (err) => {
        console.error('[historique] chargement :', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [access, chargement.essai])

  const frise = useMemo(() => {
    if (chargement.status !== 'ready') return null
    const { seances, plans, renfo } = chargement.donnees
    return construireFrise({ seances, plans, renfo, aujourdhui: todayISO() })
  }, [chargement])

  const affichee = !attente.visible && Boolean(frise) && !frise.vide
  useLayoutEffect(() => {
    if (!affichee || !reprendre || repris.current || !defile.current) return
    repris.current = true
    defile.current.scrollTop = lirePosition()
  }, [affichee, reprendre])

  const ouvrir = (lien) => {
    if (defile.current) ecrirePosition(defile.current.scrollTop)
    navigate(lien, {
      direction: 'forward',
      state: { retour: '/historique', retourEtat: { ...location.state, reprise: true } },
    })
  }

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }

  const haut = { px: space[16], pt: `calc(${HEADER_HEIGHT}px + ${space[8]})` }

  if (chargement.status === 'error') {
    return (
      <Box sx={haut}>
        <CarteSysteme
          titre="Impossible de charger l'historique"
          phrase="Les données n'ont pas pu être chargées."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Box>
    )
  }
  if (!frise) return null

  if (frise.vide) {
    return (
      <Box sx={haut}>
        <Carte sx={{ gap: space[4], p: space[16] }}>
          <Typography variant="titre-barre" component="h1" sx={{ fontWeight: 700 }}>Aucune séance faite</Typography>
          <Typography variant="secondaire" sx={{ color: 'muted' }}>
            Tes séances de course et de Renfo apparaîtront ici une fois validées.
          </Typography>
        </Carte>
      </Box>
    )
  }

  return (
    <Box ref={defile} sx={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none' }}>
      <Box sx={{ ...haut, pb: SPACE_BAS, display: 'flex', flexDirection: 'column' }}>
        {frise.elements.map((e, i) => (e.type === 'mois' ? (
          <Box
            key={e.cle}
            sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[12], px: space[4], pt: i === 0 ? 0 : '6px', pb: space[12] }}
          >
            <Typography variant="titre-section" component="h2">{e.titre}</Typography>
            <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {e.total}
            </Typography>
          </Box>
        ) : (
          <Ligne key={e.cle} e={e} onOuvrir={ouvrir} />
        )))}
      </Box>
    </Box>
  )
}

export default HistoriquePage
