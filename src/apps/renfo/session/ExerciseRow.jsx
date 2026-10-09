import { Box, Typography } from '@mui/material'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { ANCHOR_LABELS } from '../content'
import BandChip from '../BandChip'
import ExerciseThumb from './ExerciseThumb'

// Ligne d'exercice de la page séance : vignette, nom, dosage, bande, hauteur de barre.
const ExerciseRow = ({ slug, role, doseText, bandKg, bands, onOpen }) => {
  const ex = EXERCISE_INDEX[slug]
  const usesBar = ex?.equipment.includes('bar') && ex.anchor
  return (
    <Box
      onClick={onOpen}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer' }}
    >
      <ExerciseThumb slug={slug} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.25 }}>
          {role && <Box component="span" sx={{ color: 'primary.main', mr: 0.75 }}>{role}</Box>}
          {ex?.name ?? slug}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{doseText}</Typography>
        {(bandKg != null || usesBar) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
            {bandKg != null && <BandChip kg={bandKg} bands={bands} size="small" />}
            {usesBar && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {ANCHOR_LABELS[ex.anchor]}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <ChevronRight sx={{ color: 'text.disabled', fontSize: 20 }} />
    </Box>
  )
}

export default ExerciseRow
