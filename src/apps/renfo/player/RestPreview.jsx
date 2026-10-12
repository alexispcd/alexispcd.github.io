import { Box, Typography } from '@mui/material'
import SwapVert from '@mui/icons-material/SwapVert'
import { MOVE_BAR_LABELS } from '../content'
import BandButton from './BandButton'
import ExercisePhoto from './ExercisePhoto'
import { sideLabel, stepDoseText } from './labels'

/**
 * Carte « Ensuite » pendant un repos : rappel de déplacement de la barre, photo de
 * l'exercice suivant en grand, nom, dosage, bande (modifiable), installation si
 * c'est un nouvel exercice. `photo` : false en paysage, où la photo occupe la
 * colonne de gauche.
 */
const RestPreview = ({ next, newExercise, bandKg, bands, moveBarTo, onBandClick, photo = true, paused }) => {
  if (!next) return null
  const ex = next.exercise
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
      {moveBarTo && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderRadius: '16px', flexShrink: 0,
          bgcolor: 'warning.main', color: 'warning.contrastText',
        }}>
          <SwapVert />
          <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{MOVE_BAR_LABELS[moveBarTo]}</Typography>
        </Box>
      )}
      <Box sx={{ p: 1.25, borderRadius: '20px', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
        {photo && (
          <ExercisePhoto key={next.slug} slug={next.slug} paused={paused} sx={{ height: 'clamp(140px, 30vh, 300px)', borderRadius: '12px' }} />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled' }}>
              Ensuite{next.role ? ` · ${next.role}` : ''}{next.side ? ` · ${sideLabel(next.side).toLowerCase()}` : ''}
            </Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2 }}>{ex?.name ?? next.slug}</Typography>
            <Typography variant="body2" color="text.secondary">{stepDoseText(next)}</Typography>
          </Box>
          {bandKg != null && <BandButton kg={bandKg} bands={bands} onClick={onBandClick} />}
        </Box>
        {newExercise && ex?.setup && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, lineHeight: 1.45 }}>
            {ex.setup}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default RestPreview
