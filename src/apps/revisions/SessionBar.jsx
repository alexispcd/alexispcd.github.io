import { useEffect, useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import TuneRounded from '@mui/icons-material/TuneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { glassSx } from '../../styles/glass'
import { EMPTY_FILTERS } from './leitner'
import FilterSheet from './FilterSheet'

const EASE = '0.3s ease-out'

// Coins concentriques : radius externe (carte) = radius interne (boutons) + inset.
const INSET = 10
const BTN_RADIUS = 24 // boutons full pill (hauteur 48, donc radius = moitie)
const CARD_RADIUS = BTN_RADIUS + INSET

// Hauteur occupee par la barre, a degager en bas des pages qui la portent.
export const BAR_HEIGHT = 48 + INSET * 2

// Barre d'action flottante, reprise du meme motif que la barre de Cotes : une
// carte de verre fixee en bas, qui ne bouge jamais, et dans laquelle le panneau
// de filtres se deplie vers le haut en animant sa hauteur.
const SessionBar = ({ filters, onFiltersChange, onStart, startDisabled }) => {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  const panelRef = useRef(null)
  const isClosing = useRef(false)

  const hasFilters = filters.themes.length > 0 || filters.types.length > 0 || filters.angles.length > 0

  // Ouverture : hauteur 0 puis hauteur naturelle du contenu.
  useEffect(() => {
    if (!expanded || !panelRef.current) return
    const node = panelRef.current
    let cancelled = false
    node.style.transition = 'none'
    node.style.height = '0px'
    node.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      node.style.transition = `height ${EASE}`
      node.style.height = `${node.scrollHeight}px`
    })
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [expanded])

  // Fermeture animee, declenchee par le bouton ou par le clic exterieur.
  const startClose = () => {
    const node = panelRef.current
    if (!node) { setExpanded(false); return }
    isClosing.current = true
    node.style.transition = 'none'
    node.style.height = `${node.scrollHeight}px`
    requestAnimationFrame(() => {
      node.style.transition = `height ${EASE}`
      node.style.height = '0px'
    })
  }

  const handleTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'height') return
    const node = panelRef.current
    if (!node) return
    if (isClosing.current) {
      isClosing.current = false
      setExpanded(false)
    } else {
      node.style.transition = ''
      node.style.height = 'auto'
    }
  }

  const btnBase = {
    borderRadius: `${BTN_RADIUS}px`,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    height: 48,
    border: `1px solid ${theme.palette.divider}`,
  }

  return (
    <>
      {/* Backdrop invisible : capte le clic exterieur pour fermer, sans assombrir. */}
      {expanded && (
        <Box onClick={startClose} sx={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      )}

      {/* Carte flottante, elle ne bouge jamais. */}
      <Box
        sx={{
          position: 'fixed',
          left: '4vw',
          right: '4vw',
          bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          zIndex: 1001,
          borderRadius: `${CARD_RADIUS}px`,
          overflow: 'hidden',
          ...glassSx,
          // Elevation de la barre flottante de Cotes, plus marquee que celle des
          // dialogs puisqu'elle surplombe une page qui defile.
          boxShadow: (t) => t.palette.mode === 'dark'
            ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.80)',
        }}
      >
        {/* Panneau de filtres, hauteur animee. */}
        {expanded && (
          <Box ref={panelRef} onTransitionEnd={handleTransitionEnd}>
            <Box sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 2.5, pt: 1, mb: 2,
            }}>
              <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.1rem', fontWeight: 400 }}>
                Filtres
              </Typography>
              {hasFilters && (
                <Button
                  size="small"
                  onClick={() => onFiltersChange(EMPTY_FILTERS)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.secondary' }}
                >
                  Tout effacer
                </Button>
              )}
            </Box>

            <Box sx={{ px: 2.5, pb: 2 }}>
              <FilterSheet filters={filters} onChange={onFiltersChange} />
            </Box>
          </Box>
        )}

        {/* Barre d'actions, toujours rendue. Inset = INSET pour les coins concentriques. */}
        <Box sx={{ px: `${INSET}px`, pt: expanded ? 0 : `${INSET}px`, pb: `${INSET}px`, display: 'flex', gap: 1 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => { startClose(); onStart() }}
            disabled={startDisabled}
            sx={{ ...btnBase, border: 'none' }}
          >
            Démarrer une session
          </Button>

          <Button
            onClick={() => (expanded ? startClose() : setExpanded(true))}
            aria-label="Filtrer la session"
            sx={{
              ...btnBase,
              minWidth: 'unset',
              px: 1.75,
              position: 'relative',
              color: expanded ? 'text.primary' : (hasFilters ? 'primary.main' : 'text.secondary'),
              borderColor: expanded ? theme.palette.divider : (hasFilters ? 'primary.main' : theme.palette.divider),
            }}
          >
            {expanded
              ? <CloseRounded sx={{ fontSize: 20 }} />
              : <TuneRounded sx={{ fontSize: 20 }} />}
            {!expanded && hasFilters && (
              <Box sx={{
                position: 'absolute', top: 9, right: 9,
                width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main',
              }} />
            )}
          </Button>
        </Box>
      </Box>
    </>
  )
}

export default SessionBar
