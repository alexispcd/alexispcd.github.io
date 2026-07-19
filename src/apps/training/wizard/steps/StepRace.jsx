import { Box, TextField, Typography } from '@mui/material'
import { SectionLabel } from '../WizardParts'
import { nextMondayISO, todayISODate } from '../draft'

// Presets de distance (mètres). 'custom' → champ libre en mètres.
const PRESETS = [
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: 'Semi', value: 21097 },
  { label: 'Marathon', value: 42195 },
  { label: 'Autre', value: 'custom' },
]

const START_OPTIONS = [
  { label: "Aujourd'hui", value: 'today' },
  { label: 'Lundi prochain', value: 'monday' },
  { label: 'Personnalisée', value: 'custom' },
]

const Choice = ({ on, onClick, children }) => (
  <Box
    onClick={onClick}
    sx={{
      px: 1.75, py: 1, borderRadius: '12px', cursor: 'pointer', userSelect: 'none',
      fontSize: '0.82rem', fontWeight: 600, border: '1px solid',
      borderColor: on ? 'primary.main' : 'divider',
      bgcolor: on ? 'primary.light' : 'transparent',
      color: on ? 'primary.main' : 'text.secondary',
      transition: 'all .15s',
    }}
  >
    {children}
  </Box>
)

const StepRace = ({ draft, patch }) => (
  <Box>
    <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
      Ta course
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      L’objectif de ton plan et la date à viser.
    </Typography>

    <SectionLabel>Nom de la course</SectionLabel>
    <TextField
      fullWidth
      placeholder="Auray-Vannes"
      value={draft.name}
      onChange={(e) => patch({ name: e.target.value })}
    />

    <SectionLabel>Date</SectionLabel>
    <TextField
      fullWidth
      type="date"
      value={draft.date}
      onChange={(e) => patch({ date: e.target.value })}
      slotProps={{ htmlInput: { min: todayISODate() } }}
    />

    <SectionLabel>Départ de l'entraînement</SectionLabel>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {START_OPTIONS.map((o) => (
        <Choice key={o.value} on={draft.startChoice === o.value} onClick={() => patch({ startChoice: o.value })}>
          {o.label}
        </Choice>
      ))}
    </Box>
    {draft.startChoice === 'custom' && (
      <TextField
        fullWidth
        type="date"
        value={draft.startCustom}
        onChange={(e) => patch({ startCustom: e.target.value })}
        sx={{ mt: 1.25 }}
        slotProps={{ htmlInput: { min: todayISODate(), max: draft.date || undefined } }}
      />
    )}
    {draft.startChoice === 'monday' && (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, ml: 0.5 }}>
        Première semaine à partir du {new Date(nextMondayISO()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.
      </Typography>
    )}

    <SectionLabel>Distance</SectionLabel>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {PRESETS.map((p) => (
        <Choice key={p.label} on={draft.distancePreset === p.value} onClick={() => patch({ distancePreset: p.value })}>
          {p.label}
        </Choice>
      ))}
    </Box>

    {draft.distancePreset === 'custom' && (
      <TextField
        fullWidth
        type="number"
        placeholder="Distance en mètres (ex. 23000)"
        value={draft.distanceCustomM}
        onChange={(e) => patch({ distanceCustomM: e.target.value })}
        sx={{ mt: 1.25 }}
        slotProps={{ htmlInput: { min: 1, inputMode: 'numeric' } }}
      />
    )}

    <SectionLabel>Dénivelé positif (optionnel)</SectionLabel>
    <TextField
      fullWidth
      type="number"
      placeholder="D+ en mètres, laisse vide pour une course sur route"
      value={draft.elevationM}
      onChange={(e) => patch({ elevationM: e.target.value })}
      slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
    />
  </Box>
)

export default StepRace
