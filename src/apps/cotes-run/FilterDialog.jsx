import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Slider, Button } from '@mui/material'
import { SLIDERS } from './utils'

const FilterDialog = ({ open, onClose, params, setParam }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle sx={{ fontFamily: '"DM Serif Display", serif', fontWeight: 400 }}>
      Filtres
    </DialogTitle>
    <DialogContent>
      {SLIDERS.map(({ key, label, min, max, step, fmt }) => (
        <Box key={key} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {label}
            </Typography>
            <Typography variant="caption" color="primary" fontWeight={600}>
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
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained" fullWidth>Appliquer</Button>
    </DialogActions>
  </Dialog>
)

export default FilterDialog