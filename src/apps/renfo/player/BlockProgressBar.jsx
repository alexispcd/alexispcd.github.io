import { Box, ButtonBase, Typography } from '@mui/material'
import ListAlt from '@mui/icons-material/ListAlt'

/**
 * Progression par bloc : un segment par bloc, largeur proportionnelle à son poids,
 * rempli selon la fraction faite. Dessous, le libellé du bloc courant et « Plan ».
 * Toute la zone ouvre le plan. `compact` : sans le lien « Plan » (paysage).
 */
const BlockProgressBar = ({ segments, heading, onOpenPlan, compact = false }) => (
  <ButtonBase
    onClick={onOpenPlan}
    aria-label="Voir le plan de la séance"
    sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: '12px', minHeight: 44, py: 0.75 }}
  >
    <Box sx={{ display: 'flex', gap: '4px' }}>
      {segments.map((seg) => (
        <Box
          key={seg.blockIndex}
          sx={{ flex: `${Math.max(seg.weight, 1)} 1 0`, minWidth: 8, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}
        >
          <Box sx={{ width: `${Math.round(seg.done * 100)}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 3, transition: 'width 0.3s ease' }} />
        </Box>
      ))}
    </Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
      <Typography noWrap sx={{ flex: 1, fontSize: compact ? '0.75rem' : '0.82rem', fontWeight: 700, color: 'text.secondary' }}>
        {heading}
      </Typography>
      {!compact && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.main' }}>
          <ListAlt sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>Plan</Typography>
        </Box>
      )}
    </Box>
  </ButtonBase>
)

export default BlockProgressBar
