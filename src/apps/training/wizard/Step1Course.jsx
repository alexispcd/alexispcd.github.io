import { Box, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const RACE_TYPES = [
  { value: '10km',      label: '10 km' },
  { value: 'semi',      label: 'Semi-marathon' },
  { value: 'marathon',  label: 'Marathon' },
  { value: 'trail',     label: 'Trail' },
]

const weeksUntil = (dateStr) => {
  if (!dateStr) return null
  const weeks = Math.round((new Date(dateStr) - new Date()) / (7 * 24 * 3600 * 1000))
  return weeks > 0 ? weeks : null
}

const SectionLabel = ({ children }) => (
  <Typography variant="overline" color="text.secondary"
    sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 1 }}>
    {children}
  </Typography>
)

const Step1Course = ({ planContext, updateContext }) => {
  const theme = useTheme()
  const weeks = weeksUntil(planContext.raceDate)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>

      {/* Nom */}
      <Box>
        <SectionLabel>Nom de la course</SectionLabel>
        <TextField
          fullWidth size="small"
          placeholder="Auray-Vannes 2026"
          value={planContext.raceName}
          onChange={e => updateContext({ raceName: e.target.value })}
        />
      </Box>

      {/* Type */}
      <Box>
        <SectionLabel>Type de course</SectionLabel>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {RACE_TYPES.map(({ value, label }) => {
            const selected = planContext.raceType === value
            return (
              <Box
                key={value}
                onClick={() => updateContext({ raceType: value })}
                sx={{
                  p: 1.5, borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s',
                  border: selected
                    ? `2px solid ${theme.palette.primary.main}`
                    : `1px solid ${theme.palette.divider}`,
                  bgcolor: selected ? 'primary.light' : 'background.paper',
                }}
              >
                <Typography variant="body2" fontWeight={selected ? 600 : 400}
                  color={selected ? 'primary.main' : 'text.primary'}>
                  {label}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Champs Trail */}
      {planContext.raceType === 'trail' && (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <SectionLabel>Distance</SectionLabel>
            <TextField
              fullWidth size="small"
              placeholder="ex : 23 km"
              value={planContext.trailDistance}
              onChange={e => updateContext({ trailDistance: e.target.value })}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <SectionLabel>D+ (mètres)</SectionLabel>
            <TextField
              fullWidth size="small" type="number"
              placeholder="ex : 800"
              value={planContext.trailElevation}
              onChange={e => updateContext({ trailElevation: e.target.value })}
            />
          </Box>
        </Box>
      )}

      {/* Date */}
      <Box>
        <SectionLabel>Date de la course</SectionLabel>
        <TextField
          fullWidth size="small" type="date"
          value={planContext.raceDate}
          onChange={e => updateContext({ raceDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        {weeks && (
          <Typography variant="caption" color="primary.main" sx={{ mt: 0.75, display: 'block' }}>
            {weeks} semaine{weeks > 1 ? 's' : ''} jusqu'à la course
          </Typography>
        )}
      </Box>

    </Box>
  )
}

export default Step1Course
