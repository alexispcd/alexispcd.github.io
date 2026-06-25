import { Box, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { InfoOutlined } from '@mui/icons-material'

const SOURCES = [
  { value: 'coros',  label: 'Coros',            desc: 'Utiliser les données synchronisées depuis ta montre' },
  { value: 'manual', label: 'Saisie manuelle',   desc: 'Tu connais ta VMA, tu la saisis directement' },
  { value: 'test',   label: 'Test à planifier',  desc: 'Un test VMA sera intégré comme première séance' },
]

const COROS_DATA = [
  { label: 'VO2max',          value: '57' },
  { label: 'Seuil',           value: '4:27 /km' },
  { label: 'VMA',             value: '16.3 km/h' },
  { label: 'Prédiction semi', value: "1h38'55\"" },
]

const Step2Fitness = ({ planContext, updateContext }) => {
  const theme = useTheme()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>

      <Typography variant="overline" color="text.secondary"
        sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 0.5 }}>
        Source VMA
      </Typography>

      {SOURCES.map(({ value, label, desc }) => {
        const selected = planContext.vmaSource === value
        return (
          <Box
            key={value}
            onClick={() => updateContext({ vmaSource: value })}
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
            <Typography variant="caption" color="text.secondary">
              {desc}
            </Typography>
          </Box>
        )
      })}

      {/* Infobox Coros */}
      {planContext.vmaSource === 'coros' && (
        <Box sx={{
          p: 2, borderRadius: 2, mt: 0.5,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Données Coros — à synchroniser
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {COROS_DATA.map(({ label, value }) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Saisie manuelle */}
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

      {/* Info test */}
      {planContext.vmaSource === 'test' && (
        <Box sx={{
          p: 2, borderRadius: 2, mt: 0.5,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
        }}>
          <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
            Un test de type demi-Cooper sera placé en première séance. Tes allures cibles seront calculées automatiquement après le test.
          </Typography>
        </Box>
      )}

    </Box>
  )
}

export default Step2Fitness
