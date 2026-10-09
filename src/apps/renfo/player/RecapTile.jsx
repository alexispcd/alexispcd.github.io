import { Box, Typography } from '@mui/material'

// Tuile de récapitulatif de fin de séance.
const RecapTile = ({ value, label }) => (
  <Box sx={{ flex: 1, py: 1.75, borderRadius: '16px', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>{label}</Typography>
  </Box>
)

export default RecapTile
