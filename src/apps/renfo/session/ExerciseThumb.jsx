import { Box } from '@mui/material'
import FitnessCenter from '@mui/icons-material/FitnessCenter'
import { photoUrl } from '../content'

// Vignette d'un exercice : photo de départ (ou d'arrivée), sinon une icône neutre.
const ExerciseThumb = ({ slug, frame = 0, size = 48, radius = 12, sx }) => {
  const src = photoUrl(slug, frame)
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: `${radius}px`, flexShrink: 0, overflow: 'hidden',
        bgcolor: '#ffffff', border: '1px solid', borderColor: 'divider',
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
