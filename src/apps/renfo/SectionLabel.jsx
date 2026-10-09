import { Typography } from '@mui/material'

const SectionLabel = ({ children, sx }) => (
  <Typography
    variant="overline"
    sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, px: 0.5, ...sx }}
  >
    {children}
  </Typography>
)

export default SectionLabel
