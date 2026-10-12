import { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import FitnessCenter from '@mui/icons-material/FitnessCenter'
import { photoUrl } from '../content'

// Alternance départ et arrivée.
const ALTERNATE_MS = 1200
const FRAMES = [0, 1]

/**
 * Photo d'un exercice en grand : départ et arrivée en alternance (figée en pause),
 * deux pastilles indiquent l'image affichée, un toucher bascule à la main. Cadre
 * blanc dans les deux thèmes car les photos sont sur fond blanc ; `contain` car leurs
 * formats varient. Sans photo : vignette neutre. À monter avec `key={slug}`.
 */
const ExercisePhoto = ({ slug, paused = false, sx }) => {
  const hasPhoto = Boolean(photoUrl(slug, 0))
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!hasPhoto || paused) return undefined
    const id = setInterval(() => setFrame((f) => 1 - f), ALTERNATE_MS)
    return () => clearInterval(id)
  }, [hasPhoto, paused])

  const frameSx = {
    position: 'relative', width: '100%', borderRadius: '20px', overflow: 'hidden', flexShrink: 0,
    border: '1px solid', borderColor: 'divider',
    ...sx,
  }

  if (!hasPhoto) {
    return (
      <Box sx={{ ...frameSx, bgcolor: 'action.hover', color: 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FitnessCenter sx={{ fontSize: 56 }} />
      </Box>
    )
  }

  return (
    <Box onClick={() => setFrame((f) => 1 - f)} sx={{ ...frameSx, bgcolor: '#ffffff', cursor: 'pointer' }}>
      {FRAMES.map((f) => (
        <Box
          key={f}
          component="img"
          src={photoUrl(slug, f)}
          alt=""
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            opacity: frame === f ? 1 : 0, transition: 'opacity 0.25s ease',
          }}
        />
      ))}
      <Box sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 0.75 }}>
        {FRAMES.map((f) => (
          <Box key={f} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: frame === f ? 'primary.main' : 'grey.400' }} />
        ))}
      </Box>
    </Box>
  )
}

export default ExercisePhoto
