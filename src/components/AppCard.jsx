import { Card, CardContent, Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const AppCard = ({ app, dark }) => {
  const theme = useTheme()
  const isActive = app.status === 'active'

  return (
    <Card
      onClick={() => app.href && (window.location.href = app.href)}
      sx={{
        cursor: app.href ? 'pointer' : 'default',
        border: isActive
          ? `2px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        transition: 'all 0.2s',
        '&:hover': app.href ? {
          borderColor: theme.palette.primary.main,
          transform: 'translateY(-2px)',
        } : {},
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>

        {/* Icône */}
        <Box sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.5,
          background: isActive ? theme.palette.primary.light : theme.palette.divider,
          color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
        }}>
          <i className={`ti ${app.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
        </Box>

        {/* Nom */}
        <Typography variant="body2" fontWeight={600} mb={0.5}>
          {app.name}
        </Typography>

        {/* Description */}
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.4}>
          {app.desc}
        </Typography>

      </CardContent>
    </Card>
  )
}

export default AppCard