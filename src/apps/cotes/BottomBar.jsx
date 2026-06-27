import { Box, Button } from '@mui/material'
import TuneRounded from '@mui/icons-material/TuneRounded'
import MyLocationRounded from '@mui/icons-material/MyLocationRounded'
import { useTheme } from '@mui/material/styles'

const BottomBar = ({ phase, onSearch, onCancel, onReset, onFilterOpen, hasCustomParams, center }) => {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const btnBase = {
    borderRadius: 99,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    height: 48,
    border: `1px solid ${theme.palette.divider}`,
  }

  return (
    <Box sx={{
      position: 'fixed',
      bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '92vw',
      zIndex: 1000,
      background: dark
        ? 'linear-gradient(180deg, rgba(52,52,68,0.28) 0%, rgba(18,18,28,0.36) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(228,234,252,0.24) 100%)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: dark
        ? '1px solid rgba(255,255,255,0.07)'
        : '1px solid rgba(0,0,0,0.06)',
      boxShadow: dark
        ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
        : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.80)',
      borderRadius: '28px',
      px: 2,
      py: 1.25,
    }}>

      {/* État idle */}
      {phase === 'idle' && (
        <Box sx={{ textAlign: 'center', pb: 0.5 }}>
          <Box component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Appuie sur la carte pour choisir un point
          </Box>
        </Box>
      )}

      {/* État placed */}
      {phase === 'placed' && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={onSearch}
            disabled={!center}
            sx={{ ...btnBase, border: 'none' }}
          >
            Rechercher ici
          </Button>
          <Button
            onClick={onFilterOpen}
            sx={{
              ...btnBase,
              minWidth: 'unset',
              px: 1.75,
              color: hasCustomParams ? 'primary.main' : 'text.secondary',
              borderColor: hasCustomParams ? 'primary.main' : theme.palette.divider,
              position: 'relative',
            }}
          >
            <TuneRounded sx={{ fontSize: 20 }} />
            {hasCustomParams && (
              <Box sx={{
                position: 'absolute', top: 9, right: 9,
                width: 6, height: 6,
                bgcolor: 'primary.main',
                borderRadius: '50%',
              }} />
            )}
          </Button>
        </Box>
      )}

      {/* État searching */}
      {phase === 'searching' && (
        <Button
          fullWidth
          onClick={onCancel}
          sx={{ ...btnBase, color: 'error.main', borderColor: 'error.light' }}
        >
          Annuler
        </Button>
      )}

      {/* État results */}
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
          <Button
            onClick={onFilterOpen}
            sx={{
              ...btnBase,
              minWidth: 'unset',
              px: 1.75,
              color: hasCustomParams ? 'primary.main' : 'text.secondary',
              borderColor: hasCustomParams ? 'primary.main' : theme.palette.divider,
              position: 'relative',
            }}
          >
            <TuneRounded sx={{ fontSize: 20 }} />
            {hasCustomParams && (
              <Box sx={{
                position: 'absolute', top: 9, right: 9,
                width: 6, height: 6,
                bgcolor: 'primary.main',
                borderRadius: '50%',
              }} />
            )}
          </Button>
        </Box>
      )}

    </Box>
  )
}

export default BottomBar
