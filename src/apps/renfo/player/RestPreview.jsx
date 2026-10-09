import { Box, Typography } from '@mui/material'
import SwapVert from '@mui/icons-material/SwapVert'
import { MOVE_BAR_LABELS } from '../content'
import BandChip from '../BandChip'
import ExerciseThumb from '../session/ExerciseThumb'

// Aperçu de l'exercice suivant pendant un repos : nom, bande (modifiable),
// installation si c'est un nouvel exercice, rappel de déplacement de la barre.
const RestPreview = ({ next, newExercise, bandKg, bands, moveBarTo, onBandClick }) => {
  if (!next) return null
  const ex = next.exercise
  return (
    <Box sx={{ mt: 2.5, textAlign: 'left' }}>
      {moveBarTo && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5, px: 2, py: 1.5, borderRadius: '16px',
          bgcolor: 'warning.main', color: 'warning.contrastText',
        }}>
          <SwapVert />
          <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{MOVE_BAR_LABELS[moveBarTo]}</Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider' }}>
        <ExerciseThumb slug={next.slug} size={56} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled' }}>
            À suivre{next.role ? ` · ${next.role}` : ''}{next.side ? ` · côté ${next.side}` : ''}
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ lineHeight: 1.2 }}>{ex?.name ?? next.slug}</Typography>
        </Box>
        {bandKg != null && <BandChip kg={bandKg} bands={bands} onClick={onBandClick} />}
      </Box>
      {newExercise && ex?.setup && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: 0.5, lineHeight: 1.45 }}>
          {ex.setup}
        </Typography>
      )}
    </Box>
  )
}

export default RestPreview
