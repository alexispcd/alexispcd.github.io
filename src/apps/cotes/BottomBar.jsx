import { useState, useEffect, useRef } from 'react'
import { Box, Button, Slider, Typography } from '@mui/material'
import TuneRounded from '@mui/icons-material/TuneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import { useTheme } from '@mui/material/styles'
import { SLIDERS, DEFAULT_PARAMS } from './utils'

const SPRING_IN  = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
const SPRING_OUT = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
const SPRING_SNAP = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'

const BottomBar = ({ phase, onSearch, onCancel, onReset, hasCustomParams, center, params, setParam }) => {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const [filterExpanded, setFilterExpanded] = useState(false)

  const filterContentRef = useRef(null)
  const isClosing = useRef(false)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const lastY = useRef(0)

  const isDefault = Object.keys(DEFAULT_PARAMS).every(k => params[k] === DEFAULT_PARAMS[k])
  const resetParams = () => Object.entries(DEFAULT_PARAMS).forEach(([k, v]) => setParam(k, v))

  // Fermeture immédiate sur changement de phase
  useEffect(() => {
    if (phase === 'searching' || phase === 'idle') {
      isClosing.current = false
      isDragging.current = false
      setFilterExpanded(false)
    }
  }, [phase])

  // Animation d'entrée : slide depuis le bas avec spring
  useEffect(() => {
    if (!filterExpanded || !filterContentRef.current) return
    const node = filterContentRef.current
    node.style.transition = 'none'
    node.style.transform = 'translateY(100%)'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (filterContentRef.current !== node) return
        node.style.transition = SPRING_IN
        node.style.transform = 'translateY(0)'
      })
    })
  }, [filterExpanded])

  // Démarre la fermeture animée (bouton, backdrop, ou fin de drag)
  const startClose = () => {
    if (!filterContentRef.current) {
      setFilterExpanded(false)
      return
    }
    isClosing.current = true
    filterContentRef.current.style.transition = SPRING_OUT
    filterContentRef.current.style.transform = 'translateY(110%)'
  }

  // onTransitionEnd sur le contenu filtres
  const handleContentTransitionEnd = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.propertyName === 'transform' && isClosing.current) {
      isClosing.current = false
      setFilterExpanded(false) // rétracte la card
    }
  }

  // ── Drag sur le handle (et sur le contenu filtres) ──
  const onDragStart = (e) => {
    if (!filterExpanded || !filterContentRef.current) return
    isDragging.current = true
    hasDragged.current = false
    dragStartY.current = e.touches[0].clientY
    lastY.current = e.touches[0].clientY
    filterContentRef.current.style.transition = 'none'
  }

  const onDragMove = (e) => {
    if (!isDragging.current) return
    lastY.current = e.touches[0].clientY
    const delta = Math.max(0, lastY.current - dragStartY.current)
    if (filterContentRef.current) filterContentRef.current.style.transform = `translateY(${delta}px)`
  }

  const onDragEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = lastY.current - dragStartY.current
    if (delta > 80) {
      startClose()
    } else {
      if (filterContentRef.current) {
        filterContentRef.current.style.transition = SPRING_SNAP
        filterContentRef.current.style.transform = 'translateY(0)'
      }
    }
  }

  const glass = {
    background: dark
      ? 'linear-gradient(180deg, rgba(52,52,68,0.28) 0%, rgba(18,18,28,0.36) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(228,234,252,0.24) 100%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: dark
      ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.80)',
  }

  const btnBase = {
    borderRadius: 99,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    height: 48,
    border: `1px solid ${theme.palette.divider}`,
  }

  const filterBtn = (
    <Button
      onClick={() => filterExpanded ? startClose() : setFilterExpanded(true)}
      sx={{
        ...btnBase,
        minWidth: 'unset',
        px: 1.75,
        color: filterExpanded ? 'text.primary' : (hasCustomParams ? 'primary.main' : 'text.secondary'),
        borderColor: filterExpanded ? theme.palette.divider : (hasCustomParams ? 'primary.main' : theme.palette.divider),
        position: 'relative',
      }}
    >
      {filterExpanded
        ? <CloseRounded sx={{ fontSize: 20 }} />
        : <TuneRounded sx={{ fontSize: 20 }} />
      }
      {!filterExpanded && hasCustomParams && (
        <Box sx={{
          position: 'absolute', top: 9, right: 9,
          width: 6, height: 6,
          bgcolor: 'primary.main',
          borderRadius: '50%',
        }} />
      )}
    </Button>
  )

  return (
    <>
      {/* Backdrop */}
      {filterExpanded && (
        <Box
          onClick={startClose}
          sx={{
            position: 'fixed', inset: 0, zIndex: 999,
            bgcolor: dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)',
          }}
        />
      )}

      {/* Card — ne bouge jamais */}
      <Box
        sx={{
          position: 'fixed',
          left: '4vw',
          right: '4vw',
          bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          zIndex: 1001,
          borderRadius: '28px',
          overflow: 'hidden',
          ...glass,
        }}
      >
        {/* Contenu filtres — monté uniquement quand filterExpanded */}
        {filterExpanded && (
          <Box
            ref={filterContentRef}
            onTransitionEnd={handleContentTransitionEnd}
            onTouchStart={onDragStart}
            onTouchMove={onDragMove}
            onTouchEnd={onDragEnd}
            sx={{ touchAction: 'pan-x' }}
          >
            {/* Handle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
              <Box sx={{ width: 36, height: 4, borderRadius: 99, bgcolor: 'text.disabled', opacity: 0.35 }} />
            </Box>

            {/* Titre */}
            <Box sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 2.5, pt: 2, mb: 2,
            }}>
              <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.1rem', fontWeight: 400 }}>
                Filtres
              </Typography>
              {!isDefault && (
                <Button
                  size="small"
                  onClick={resetParams}
                  onTouchStart={e => e.stopPropagation()}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.secondary' }}
                >
                  Réinitialiser
                </Button>
              )}
            </Box>

            {/* Sliders */}
            <Box sx={{ px: 2.5, pb: 2 }}>
              {SLIDERS.map(s => (
                <Box key={s.key} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                      {s.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
                      {s.range
                        ? `${s.fmt(params[s.minKey])} — ${s.fmt(params[s.maxKey])}`
                        : s.fmt(params[s.key])
                      }
                    </Typography>
                  </Box>

                  {s.range ? (
                    <Slider
                      value={[params[s.minKey], params[s.maxKey]]}
                      onChange={(_, v) => { setParam(s.minKey, v[0]); setParam(s.maxKey, v[1]) }}
                      min={s.min} max={s.max} step={s.step}
                      disableSwap size="small" sx={{ mx: 1, width: 'calc(100% - 16px)' }}
                    />
                  ) : (
                    <Slider
                      value={params[s.key]}
                      onChange={(_, v) => setParam(s.key, v)}
                      min={s.min} max={s.max} step={s.step}
                      size="small" sx={{ mx: 1, width: 'calc(100% - 16px)' }}
                    />
                  )}

                  {s.range && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                        {s.fmt(s.min)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                        {s.fmt(s.max)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Barre d'actions — toujours rendue */}
        <Box sx={{ px: 2, pb: 1.25 }}>
          {phase === 'idle' && (
            <Box sx={{ textAlign: 'center', py: 0.5 }}>
              <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                Appuie sur la carte pour choisir un point
              </Box>
            </Box>
          )}

          {phase === 'placed' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => { startClose(); onSearch() }}
                disabled={!center}
                sx={{ ...btnBase, border: 'none' }}
              >
                Rechercher ici
              </Button>
              {filterBtn}
            </Box>
          )}

          {phase === 'searching' && (
            <Button
              fullWidth
              onClick={onCancel}
              sx={{ ...btnBase, color: 'error.main', borderColor: 'error.light' }}
            >
              Annuler
            </Button>
          )}

          {phase === 'results' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                onClick={onReset}
                startIcon={<MyLocationRounded sx={{ fontSize: 16 }} />}
                sx={{ ...btnBase, color: 'text.secondary' }}
              >
                Nouvelle recherche
              </Button>
              {filterBtn}
            </Box>
          )}
        </Box>
      </Box>
    </>
  )
}

export default BottomBar
