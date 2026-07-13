import { Box, Typography } from '@mui/material'
import { cardSx } from '../../../styles/glass'

export const SectionLabel = ({ children, sx }) => (
  <Typography
    variant="overline"
    sx={{
      display: 'block', color: 'text.disabled', letterSpacing: '0.12em',
      fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, ...sx,
    }}
  >
    {children}
  </Typography>
)

export const GlassCard = ({ children, sx }) => (
  <Box sx={{ ...cardSx, borderRadius: '20px', p: 2, ...sx }}>{children}</Box>
)
