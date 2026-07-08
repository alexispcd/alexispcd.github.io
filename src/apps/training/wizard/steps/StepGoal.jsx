import {
  Box, Typography, TextField, IconButton, Button,
} from '@mui/material'
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutlineOutlined'
import { SectionLabel, GlassCard } from '../WizardParts'
import { parseTimeInput } from '../../constants'

const PREDICTION_LABELS = [
  ['five_k', '5 km'],
  ['ten_k', '10 km'],
  ['half', 'Semi'],
  ['marathon', 'Marathon'],
]

const StepGoal = ({ draft, patch }) => {
  const preds = draft.source === 'coros' ? draft.predictions : null
  const availablePreds = preds ? PREDICTION_LABELS.filter(([k]) => preds[k]) : []

  const goalInvalid = draft.goalTime.trim() !== '' && parseTimeInput(draft.goalTime) == null

  const updateRace = (i, field, value) =>
    patch({
      previousRaces: draft.previousRaces.map((r, j) => (j === i ? { ...r, [field]: value } : r)),
    })
  const addRace = () => patch({ previousRaces: [...draft.previousRaces, { name: '', time: '' }] })
  const removeRace = (i) =>
    patch({ previousRaces: draft.previousRaces.filter((_, j) => j !== i) })

  return (
    <Box>
      <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
        Ton objectif
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Tout est optionnel — ces éléments affinent le plan.
      </Typography>

      <SectionLabel>Temps cible (optionnel)</SectionLabel>
      <TextField
        fullWidth
        placeholder="1:29:00"
        value={draft.goalTime}
        onChange={(e) => patch({ goalTime: e.target.value })}
        error={goalInvalid}
        helperText={goalInvalid ? 'Format h:mm:ss ou mm:ss' : 'Format h:mm:ss'}
      />

      {availablePreds.length > 0 && (
        <GlassCard sx={{ mt: 1.5, p: 1.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Repère — prédictions Coros
          </Typography>
          <Box sx={{ display: 'flex', gap: 2.5, mt: 1, flexWrap: 'wrap' }}>
            {availablePreds.map(([k, label]) => (
              <Box key={k}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {preds[k]}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </GlassCard>
      )}

      <SectionLabel>Courses précédentes (optionnel)</SectionLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {draft.previousRaces.map((r, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              placeholder="Course"
              value={r.name}
              onChange={(e) => updateRace(i, 'name', e.target.value)}
              sx={{ flex: 2 }}
            />
            <TextField
              placeholder="Temps"
              value={r.time}
              onChange={(e) => updateRace(i, 'time', e.target.value)}
              sx={{ flex: 1 }}
            />
            <IconButton onClick={() => removeRace(i)} sx={{ color: 'text.secondary', flexShrink: 0 }}>
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>
      <Button
        startIcon={<AddCircleOutline />}
        onClick={addRace}
        sx={{ mt: 1, color: 'text.secondary' }}
        size="small"
      >
        Ajouter une course
      </Button>

      <SectionLabel>Remarques (optionnel)</SectionLabel>
      <TextField
        fullWidth
        multiline
        minRows={3}
        placeholder="Contraintes, jours indisponibles, blessures…"
        value={draft.notes}
        onChange={(e) => patch({ notes: e.target.value })}
      />
    </Box>
  )
}

export default StepGoal
