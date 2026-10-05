import { Card, CardContent, Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'

const AppCard = ({ module }) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const Icon = module.icon

  return (
    <Card
      onClick={() => navigate(module.path)}
      sx={{
        cursor: 'pointer',
        border: `2px solid ${theme.palette.primary.main}`,
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          transform: 'translateY(-2px)',
        },
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
          background: theme.palette.primary.light,
          color: theme.palette.primary.main,
        }}>
          <Icon sx={{ fontSize: 16 }} aria-hidden="true" />
        </Box>

        {/* Nom */}
        <Typography variant="body2" fontWeight={600} mb={0.5}>
          {module.name}
        </Typography>

        {/* Description */}
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.4}>
          {module.description}
        </Typography>

      </CardContent>
    </Card>
  )
}

export default AppCard
