import { Box, Typography, CircularProgress, TextField, Alert, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const MODES = [
  { value: 'coros',  label: 'Données Coros',   desc: 'VO2max, seuil et prédictions depuis ta montre' },
  { value: 'manual', label: 'Saisie manuelle', desc: 'Tu connais ta VMA, tu la saisis directement' },
]

const Step2Fitness = ({ planContext, updateContext, corosFitnessState, onRetryFitness }) => {
  const theme = useTheme()
  const { status, data: fitnessData, error: fitnessError } = corosFitnessState ?? { status: 'loading', data: null, error: '' }

  const selectMode = (mode) => {
    if (mode === planContext.vmaSource) return
    if (mode === 'coros') {
      updateContext({
        vmaSource: 'coros',
        fitnessSnapshot: status === 'ready' ? fitnessData : null,
      })
    } else {
      updateContext({ vmaSource: 'manual', fitnessSnapshot: null })
    }
  }

  const snap = planContext.fitnessSnapshot
  const vmaDerivee = snap?.vo2max ? (snap.vo2max / 3.5).toFixed(1) : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>

      <Typography variant="overline" color="text.secondary"
        sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 0.5 }}>
        Source VMA
      </Typography>

      {MODES.map(({ value, label, desc }) => {
        const selected = planContext.vmaSource === value
        return (
          <Box
            key={value}
            onClick={() => selectMode(value)}
            sx={{
              p: 2, borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
              border: selected
                ? `2px solid ${theme.palette.primary.main}`
                : `1px solid ${theme.palette.divider}`,
              bgcolor: selected ? 'primary.light' : 'background.paper',
            }}
          >
            <Typography variant="body2" fontWeight={600}
              color={selected ? 'primary.main' : 'text.primary'}>
              {label}
            </Typography>
            <Typography variant="caption" color="text.secondary">{desc}</Typography>
          </Box>
        )
      })}

      {planContext.vmaSource === 'coros' && (
        <Box sx={{ mt: 0.5 }}>
          {status === 'loading' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Récupération des données Coros…
              </Typography>
            </Box>
          )}

          {status === 'error' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5, fontSize: '0.78rem' }}>
                {fitnessError}
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={onRetryFitness}>
                  Réessayer
                </Button>
                <Button size="small" onClick={() => selectMode('manual')} sx={{ color: 'text.secondary' }}>
                  Saisie manuelle
                </Button>
              </Box>
            </Box>
          )}

          {status === 'ready' && snap && (
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid', borderColor: 'divider',
            }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'VO2max',          value: snap.vo2max },
                  { label: 'Seuil',           value: snap.threshold_pace },
                  { label: 'VMA dérivée',     value: vmaDerivee ? `${vmaDerivee} km/h` : '—' },
                  { label: 'Prédiction semi', value: snap.predictions?.half ?? '—' },
                ].map(({ label, value }) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {planContext.vmaSource === 'manual' && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="overline" color="text.secondary"
            sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 1 }}>
            VMA (km/h)
          </Typography>
          <TextField
            fullWidth size="small" type="number"
            placeholder="ex : 15.5"
            value={planContext.vmaManual}
            onChange={e => updateContext({ vmaManual: e.target.value })}
            inputProps={{ step: 0.1, min: 8, max: 30 }}
          />
        </Box>
      )}

    </Box>
  )
}

export default Step2Fitness
