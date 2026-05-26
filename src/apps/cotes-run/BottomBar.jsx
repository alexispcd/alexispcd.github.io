import { Box, Button } from '@mui/material'
import { TuneRounded, MyLocationRounded } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'

const BottomBar = ({ phase, onSearch, onCancel, onReset, onFilterOpen, hasCustomParams, center }) => {
  const theme = useTheme()

  const btnBase = {
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.8rem',
    height: 40,
    border: `1px solid ${theme.palette.divider}`,
  }

  return (
    <Box sx={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 1000,
      bgcolor: 'background.paper',
      borderRadius: '16px 16px 0 0',
      px: 1.5, py: 1.25, pb: 'calc(1.25rem + env(safe-area-inset-bottom, 8px))',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
    }}>

      {/* État idle */}
      {phase === 'idle' && (
        <Box sx={{ textAlign: 'center', py: 0.5 }}>
          <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
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
              px: 1.5,
              color: hasCustomParams ? 'primary.main' : 'text.secondary',
              borderColor: hasCustomParams ? 'primary.main' : theme.palette.divider,
              position: 'relative',
            }}
          >
            <TuneRounded sx={{ fontSize: 18 }} />
            {hasCustomParams && (
              <Box sx={{
                position: 'absolute', top: 5, right: 5,
                width: 6, height: 6,
                bgcolor: 'primary.main',
                borderRadius: '50%',
                border: '1px solid',
                borderColor: 'background.paper',
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
          sx={{
            ...btnBase,
            color: 'error.main',
            borderColor: 'error.light',
            bgcolor: 'error.50',
          }}
        >
          Annuler la recherche
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
              px: 1.5,
              color: hasCustomParams ? 'primary.main' : 'text.secondary',
              borderColor: hasCustomParams ? 'primary.main' : theme.palette.divider,
              position: 'relative',
            }}
          >
            <TuneRounded sx={{ fontSize: 18 }} />
            {hasCustomParams && (
              <Box sx={{
                position: 'absolute', top: 5, right: 5,
                width: 6, height: 6,
                bgcolor: 'primary.main',
                borderRadius: '50%',
                border: '1px solid',
                borderColor: 'background.paper',
              }} />
            )}
          </Button>
        </Box>
      )}

    </Box>
  )
}

export default BottomBar