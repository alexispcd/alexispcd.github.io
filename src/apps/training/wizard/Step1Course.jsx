import { Box, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const RACE_TYPES = [
  { value: '10km',     label: '10 km' },
  { value: 'semi',     label: 'Semi-marathon' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'trail',    label: 'Trail' },
]

const toDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayStr     = () => toDateStr(new Date())
const nextMondayStr = () => {
  const d = new Date()
  const daysUntil = (1 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return toDateStr(d)
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return null
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const weeksCount = (startStr, endStr) => {
  if (!startStr || !endStr) return null
  const weeks = Math.round((new Date(endStr) - new Date(startStr)) / (7 * 24 * 3600 * 1000))
  return weeks > 0 ? weeks : null
}

const START_OPTIONS = [
  { value: 'today',       label: "Aujourd'hui",       getDate: todayStr },
  { value: 'next_monday', label: 'Lundi prochain',    getDate: nextMondayStr },
  { value: 'custom',      label: 'Date personnalisée', getDate: null },
]

const SectionLabel = ({ children }) => (
  <Typography variant="overline" color="text.secondary"
    sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 1 }}>
    {children}
  </Typography>
)

const Step1Course = ({ planContext, updateContext }) => {
  const theme = useTheme()
  const weeks = weeksCount(planContext.startDate, planContext.raceDate)

  const handleStartMode = (mode) => {
    if (mode === 'custom') {
      updateContext({ startDateMode: 'custom' })
    } else {
      const opt = START_OPTIONS.find(o => o.value === mode)
      updateContext({ startDateMode: mode, startDate: opt.getDate() })
    }
  }

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

      {/* Date de la course */}
      <Box>
        <SectionLabel>Date de la course</SectionLabel>
        <TextField
          fullWidth size="small" type="date"
          value={planContext.raceDate}
          onChange={e => updateContext({ raceDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Début du plan */}
      <Box>
        <SectionLabel>Début du plan</SectionLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {START_OPTIONS.map(({ value, label }) => {
            const selected = planContext.startDateMode === value
            return (
              <Box
                key={value}
                onClick={() => handleStartMode(value)}
                sx={{
                  px: 2, py: 1.25, borderRadius: 2, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
                {selected && value !== 'custom' && planContext.startDate && (
                  <Typography variant="caption" color="primary.main" sx={{ ml: 1, flexShrink: 0 }}>
                    {formatShortDate(planContext.startDate)}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>

        {planContext.startDateMode === 'custom' && (
          <TextField
            fullWidth size="small" type="date"
            value={planContext.startDate}
            onChange={e => updateContext({ startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 1.5 }}
          />
        )}
      </Box>

      {/* Durée calculée */}
      {weeks && (
        <Typography variant="caption" color="primary.main" sx={{ mt: -1.5, display: 'block' }}>
          {weeks} semaine{weeks > 1 ? 's' : ''} de préparation
        </Typography>
      )}

    </Box>
  )
}

export default Step1Course
