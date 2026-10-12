import { Button } from '@mui/material'

/**
 * Bouton principal du player, sous le pouce : plein en couleur primaire
 * (`primary`), contour primaire (`outlined`) ou neutre (`neutral`).
 */
const MainButton = ({ label, tone, height, onClick }) => (
  <Button
    fullWidth
    variant={tone === 'outlined' ? 'outlined' : 'contained'}
    onClick={onClick}
    sx={{
      flex: 1, height, borderRadius: `${height / 2}px`,
      textTransform: 'none', fontWeight: 800, fontSize: '1.1rem', boxShadow: 'none',
      ...(tone === 'outlined' && { borderWidth: 2, borderColor: 'primary.main', '&:hover': { borderWidth: 2 } }),
      ...(tone === 'neutral' && {
        bgcolor: 'action.selected', color: 'text.primary',
        '&:hover': { bgcolor: 'action.focus', boxShadow: 'none' },
      }),
    }}
  >
    {label}
  </Button>
)

export default MainButton
