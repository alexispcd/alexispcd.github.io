import { Box } from '@mui/material'
import { bandColorFor, formatKg, textOnColor } from './bandColor'

// Pastille d'un élastique : sa couleur, son poids écrit dessus. Couleur lue dans
// l'inventaire par kg ; pastille neutre si ce kg n'existe plus.
const BandChip = ({ kg, bands, color, size = 'medium', onClick, sx }) => {
  const bg = color ?? bandColorFor(bands ?? [], kg)
  const small = size === 'small'
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: small ? 38 : 48, height: small ? 20 : 26, px: small ? 0.75 : 1,
        borderRadius: 999, border: 'none', font: 'inherit',
        fontSize: small ? '0.66rem' : '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        bgcolor: bg, color: textOnColor(bg), flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        ...sx,
      }}
    >
      {formatKg(kg)} kg
    </Box>
  )
}

export default BandChip
