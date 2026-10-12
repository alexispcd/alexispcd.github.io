import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'

// Puces A, B, C d'un superset ou d'un triset : faites en teinte légère, en cours
// pleine, à venir en contour.
const RoleChips = ({ roles, current }) => {
  const at = roles.indexOf(current)
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {roles.map((role, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'next'
        return (
          <Box
            key={role}
            sx={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 800, border: '1.5px solid',
              borderColor: state === 'next' ? 'divider' : 'primary.main',
              bgcolor: state === 'current' ? 'primary.main' : state === 'done' ? (t) => alpha(t.palette.primary.main, 0.16) : 'transparent',
              color: state === 'current' ? 'primary.contrastText' : state === 'done' ? 'primary.main' : 'text.secondary',
            }}
          >
            {role}
          </Box>
        )
      })}
    </Box>
  )
}

export default RoleChips
