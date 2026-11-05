import { Box } from '@mui/material'
import FitnessCenter from '@mui/icons-material/FitnessCenter'
import { photoUrl } from '../content'

// Vignette d'un exercice : photo de départ (ou d'arrivée) sur fond blanc, comme les
// photos, sinon une icône neutre. radius : px en nombre, ou une chaîne (jeton) ;
// sansContour : sans le filet (page séance et Remplacer).
const ExerciseThumb = ({ slug, frame = 0, size = 48, radius = 12, sansContour = false, sx }) => {
  const src = photoUrl(slug, frame)
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        flexShrink: 0, overflow: 'hidden',
        bgcolor: src ? '#ffffff' : 'action.hover', border: sansContour ? 'none' : '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled',
        ...sx,
      }}
    >
      {src
        ? <Box component="img" src={src} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <FitnessCenter sx={{ fontSize: size * 0.45 }} />}
    </Box>
  )
}

export default ExerciseThumb
