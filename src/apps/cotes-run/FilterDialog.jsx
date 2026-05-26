import { Drawer, Box, Typography, Slider, Button } from '@mui/material'
import { SLIDERS, DEFAULT_PARAMS } from './utils'

const FilterDialog = ({ open, onClose, params, setParam }) => {
  const isDefault = Object.keys(DEFAULT_PARAMS).every(k => params[k] === DEFAULT_PARAMS[k])
  const reset = () => Object.entries(DEFAULT_PARAMS).forEach(([k, v]) => setParam(k, v))

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '20px 20px 0 0',
          px: 2.5,
          pt: 2.5,
          pb: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.25rem', fontWeight: 400 }}>
          Filtres
        </Typography>
        {!isDefault && (
          <Button
            size="small"
            onClick={reset}
            sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'text.secondary' }}
          >
            Réinitialiser
          </Button>
        )}
      </Box>

      {/* Sliders */}
      {SLIDERS.map(s => (
        <Box key={s.key} sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.25 }}>
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
              disableSwap
              size="small"
            />
          ) : (
            <Slider
              value={params[s.key]}
              onChange={(_, v) => setParam(s.key, v)}
              min={s.min} max={s.max} step={s.step}
              size="small"
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

      <Box sx={{ height: '1px', bgcolor: 'divider', mx: -2.5, mb: 2.5 }} />

      <Button
        variant="contained"
        fullWidth
        onClick={onClose}
        sx={{ borderRadius: 99, height: 48, textTransform: 'none', fontWeight: 500, border: 'none' }}
      >
        Appliquer
      </Button>
    </Drawer>
  )
}

export default FilterDialog
