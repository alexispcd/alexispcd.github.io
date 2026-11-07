import { Box, Typography } from '@mui/material'
import { formatShortDay } from '../../lib/dates'
import { space } from '../../styles/tokens'

/** Titre du bloc « Aujourd'hui » et date du jour (« sam 7 nov »), à droite. */
const EnTeteAujourdhui = ({ aujourdhui }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8] }}>
    <Typography variant="titre-section" component="h2">Aujourd'hui</Typography>
    <Typography variant="legende" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{formatShortDay(aujourdhui)}</Typography>
  </Box>
)

export default EnTeteAujourdhui
