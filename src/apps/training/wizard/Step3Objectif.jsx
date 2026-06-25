import { Box, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { InfoOutlined } from '@mui/icons-material'

const PALIERS = [
  { value: 'realistic',      label: 'Réaliste',       time: "1h40'00\"", desc: 'Proche de ta prédiction actuelle' },
  { value: 'ambitious',      label: 'Ambitieux',      time: "1h38'00\"", desc: 'Progression de 1 à 2 min' },
  { value: 'very_ambitious', label: 'Très ambitieux', time: "1h36'00\"", desc: 'Progression maximum, tout laisser sur la route' },
]

const SectionLabel = ({ children }) => (
  <Typography variant="overline" color="text.secondary"
    sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 1 }}>
    {children}
  </Typography>
)

const Step3Objectif = ({ planContext, updateContext }) => {
  const theme = useTheme()

  const handlePalier = (palier) => {
    updateContext({ targetPalier: palier.value, targetTime: palier.time })
  }

  const handleCustomTime = (e) => {
    updateContext({ targetPalier: null, targetTime: e.target.value })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>

      {/* Infobox repères */}
      <Box sx={{
        p: 2, borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid', borderColor: 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Repères
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">Prédiction Coros</Typography>
            <Typography variant="caption" fontWeight={600}>1h38'55"</Typography>
          </Box>
          {planContext.previousRaces?.map(race => (
            <Box key={race.year} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">{race.label}</Typography>
              <Typography variant="caption" fontWeight={600}>{race.time}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Paliers */}
      <Box>
        <SectionLabel>Palier d'objectif</SectionLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {PALIERS.map((palier) => {
            const selected = planContext.targetPalier === palier.value
            return (
              <Box
                key={palier.value}
                onClick={() => handlePalier(palier)}
                sx={{
                  p: 2, borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: selected
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${theme.palette.divider}`,
                  bgcolor: selected ? 'primary.light' : 'background.paper',
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}
                    color={selected ? 'primary.main' : 'text.primary'}>
                    {palier.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {palier.desc}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={700}
                  color={selected ? 'primary.main' : 'text.secondary'}
                  sx={{ ml: 2, flexShrink: 0 }}>
                  {palier.time}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Saisie libre */}
      <Box>
        <SectionLabel>Ou saisir un temps précis</SectionLabel>
        <TextField
          fullWidth size="small"
          placeholder="ex : 1h37'30\""
          value={planContext.targetPalier ? '' : planContext.targetTime}
          onChange={handleCustomTime}
        />
      </Box>

    </Box>
  )
}

export default Step3Objectif
