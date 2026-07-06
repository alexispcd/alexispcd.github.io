import { useState, useEffect, useRef } from 'react'
import { Box, Button, Slider, Typography } from '@mui/material'
import TuneRounded from '@mui/icons-material/TuneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import { useTheme } from '@mui/material/styles'
import { SLIDERS, DEFAULT_PARAMS } from './utils'

const EASE = '0.3s ease-out'

const BottomBar = ({ phase, onSearch, onCancel, onReset, hasCustomParams, center, params, setParam }) => {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const [filterExpanded, setFilterExpanded] = useState(false)

  const filterRef = useRef(null)
  const isClosing = useRef(false)

  const isDefault = Object.keys(DEFAULT_PARAMS).every(k => params[k] === DEFAULT_PARAMS[k])
  const resetParams = () => Object.entries(DEFAULT_PARAMS).forEach(([k, v]) => setParam(k, v))

  // Fermeture immédiate sur changement de phase
  useEffect(() => {
    if (phase === 'searching' || phase === 'idle') {
      isClosing.current = false
      setFilterExpanded(false)
      if (filterRef.current) {
        filterRef.current.style.cssText = ''
      }
    }
  }, [phase])

  // Animation d'ouverture : height 0 → naturel
  useEffect(() => {
    if (!filterExpanded || !filterRef.current) return
    const node = filterRef.current
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
  }, [filterExpanded])

  // Démarre la fermeture animée (bouton, backdrop)
  const startClose = () => {
    const node = filterRef.current
    if (!node) { setFilterExpanded(false); return }
    isClosing.current = true
    node.style.transition = 'none'
    node.style.height = `${node.scrollHeight}px`
    requestAnimationFrame(() => {
      node.style.transition = `height ${EASE}`
      node.style.height = '0px'
    })
  }

  // onTransitionEnd sur le contenu filtres
  const handleTransitionEnd = (e) => {
    if (e.target !== e.currentTarget) return
    const node = filterRef.current
    if (!node) return
    if (e.propertyName === 'height') {
      if (isClosing.current) {
        isClosing.current = false
        setFilterExpanded(false)
      } else {
        node.style.transition = ''
        node.style.height = 'auto'
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
        {/* Contenu filtres — height animée */}
        {filterExpanded && (
          <Box
            ref={filterRef}
            onTransitionEnd={handleTransitionEnd}
          >
            {/* Titre */}
            <Box sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 2.5, pt: 1, mb: 2,
            }}>
              <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.1rem', fontWeight: 400 }}>
                Filtres
              </Typography>
              {!isDefault && (
                <Button
                  size="small"
                  onClick={resetParams}
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
        <Box sx={{ px: 2, pt: filterExpanded ? 0 : 1.25, pb: 1.25 }}>
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
