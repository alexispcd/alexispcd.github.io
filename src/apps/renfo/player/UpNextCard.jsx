import { Box, Typography } from '@mui/material'
import { formatClock } from '../dates'
import BandButton from './BandButton'
import ExerciseThumb from '../session/ExerciseThumb'
import { stepDoseText } from './labels'

/**
 * Carte compacte d'un exercice à venir : vignette, rôle et nom, dosage, récup qui le
 * précède, bande. `title` : surtitre optionnel (« Ensuite »).
 */
const UpNextCard = ({ step, rest, bandKg, bands, title, onBandClick }) => {
  const name = step.exercise?.name ?? step.slug
  const meta = [
    stepDoseText(step),
    rest ? `après ${formatClock(rest.duration_sec)} de récup` : null,
  ].filter(Boolean).join(' · ')
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 0.5, borderRadius: '16px', border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
      <ExerciseThumb slug={step.slug} size={44} radius={8} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title && (
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled' }}>
            {title}
          </Typography>
        )}
        <Typography noWrap sx={{ fontSize: '0.92rem', fontWeight: 700, lineHeight: 1.25 }}>
          {step.role && <Box component="span" sx={{ color: 'primary.main' }}>{step.role} · </Box>}
          {name}
        </Typography>
        <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block' }}>{meta}</Typography>
      </Box>
      {bandKg != null && (
        <BandButton kg={bandKg} bands={bands} onClick={onBandClick} />
      )}
    </Box>
  )
}

export default UpNextCard
