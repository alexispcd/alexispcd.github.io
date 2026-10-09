import { Box, Typography } from '@mui/material'
import { formatClock } from '../dates'

const RING = 248
const STROKE = 14
const R = (RING - STROKE) / 2
const CIRC = 2 * Math.PI * R

// Anneau de progression du décompte, temps restant au centre.
const ProgressRing = ({ fraction, remainingSec, sub, color, size = RING }) => (
  <Box sx={{ position: 'relative', width: size, height: size, maxWidth: '70vw', maxHeight: '70vw', mx: 'auto' }}>
    <Box component="svg" viewBox={`0 0 ${RING} ${RING}`} sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={STROKE} />
      <circle
        cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 0.25s linear' }}
      />
    </Box>
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography sx={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {formatClock(remainingSec)}
      </Typography>
      {sub && (
        <Typography sx={{ mt: 1, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary' }}>
          {sub}
        </Typography>
      )}
    </Box>
  </Box>
)

export default ProgressRing
