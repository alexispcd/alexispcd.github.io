import { Box, Button } from '@mui/material'
import { TuneRounded, MyLocationRounded } from '@mui/icons-material'
import { useTheme, alpha } from '@mui/material/styles'

const BottomBar = ({ phase, onSearch, onCancel, onReset, onFilterOpen, hasCustomParams, center }) => {
  const theme = useTheme()

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
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 1000,
      background: alpha(theme.palette.background.paper, 0.9),
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${theme.palette.divider}`,
      px: 2,
      pt: 1.25,
      pb: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))',
    }}>

      {/* Pill */}
      <Box sx={{
        width: 36, height: 4,
        bgcolor: 'divider',
        borderRadius: 2,
        mx: 'auto',
        mb: 1.5,
      }} />

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
