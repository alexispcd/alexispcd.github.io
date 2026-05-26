import { Drawer, Box, Typography, Slider, Button, Chip } from '@mui/material'
import { SLIDERS, DEFAULT_PARAMS, PRESETS } from './utils'

const FilterDialog = ({ open, onClose, params, setParam }) => {
  const isDefault = Object.keys(DEFAULT_PARAMS).every(k => params[k] === DEFAULT_PARAMS[k])

  const applyPreset = (preset) => {
    Object.entries(preset.params).forEach(([k, v]) => setParam(k, v))
  }

  const reset = () => {
    Object.entries(DEFAULT_PARAMS).forEach(([k, v]) => setParam(k, v))
  }

  const activePreset = PRESETS.find(p =>
    Object.entries(p.params).every(([k, v]) => params[k] === v)
  )?.label ?? null

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
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

      {/* Presets */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3.5 }}>
        {PRESETS.map(p => (
          <Chip
            key={p.label}
            label={p.label}
            onClick={() => applyPreset(p)}
            variant={activePreset === p.label ? 'filled' : 'outlined'}
            color={activePreset === p.label ? 'primary' : 'default'}
            size="small"
            sx={{ flex: 1, borderRadius: 99, fontWeight: activePreset === p.label ? 600 : 400 }}
          />
        ))}
      </Box>

      {/* Sliders */}
      {SLIDERS.map(({ key, label, min, max, step, fmt }) => (
        <Box key={key} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {fmt(params[key])}
            </Typography>
          </Box>
          <Slider
            value={params[key]}
            onChange={(_, v) => setParam(key, v)}
            min={min} max={max} step={step}
            size="small"
          />
        </Box>
      ))}

      {/* Apply */}
      <Button
        variant="contained"
        fullWidth
        onClick={onClose}
        sx={{ borderRadius: 99, height: 48, textTransform: 'none', fontWeight: 500, border: 'none', mt: 0.5 }}
      >
        Appliquer
      </Button>
    </Drawer>
  )
}

export default FilterDialog
