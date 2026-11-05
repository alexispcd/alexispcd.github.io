import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import { focusContour, sansMouvement } from '../../../ui/appui'

/**
 * Progression du player : un segment par bloc, largeur selon son poids (blockProgress),
 * rempli selon la part faite ; dessous, le bloc en cours (« Superset 2 · Haut du corps »)
 * et sa position à droite (« Tour 2 / 4 »). Toute la zone ouvre le plan.
 */
const ProgressionBlocs = ({ segments, heading, position, onOuvrir, sx }) => (
  <ButtonBase
    onClick={onOuvrir}
    aria-label="Voir le plan de la séance"
    sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: space[8],
      width: '100%', minHeight: size.cible, textAlign: 'left', borderRadius: radius.inner, color: 'ink',
      ...focusContour, ...sx,
    }}
  >
    <Box sx={{ display: 'flex', gap: space[4], width: '100%' }}>
      {segments.map((seg) => (
        <Box
          key={seg.blockIndex}
          sx={{ flex: `${Math.max(seg.weight, 1)} 1 0`, minWidth: '8px', height: '6px', borderRadius: radius.segment, bgcolor: 'track', overflow: 'hidden' }}
        >
          <Box
            sx={{
              width: `${Math.round(seg.done * 100)}%`, height: '100%', bgcolor: 'ink',
              transition: transition('width', DURATION.open), ...sansMouvement(),
            }}
          />
        </Box>
      ))}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8], width: '100%' }}>
      <Typography variant="secondaire" component="span" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>{heading}</Typography>
      {position && (
        <Typography variant="secondaire" component="span" sx={{ color: 'muted', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {position}
        </Typography>
      )}
    </Box>
  </ButtonBase>
)

export default ProgressionBlocs
