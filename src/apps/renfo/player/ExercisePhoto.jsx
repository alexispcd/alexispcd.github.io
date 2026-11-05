import { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { photoUrl } from '../content'
import { radius, space } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import { sansMouvement } from '../../../ui/appui'

// Alternance départ et arrivée.
const ALTERNATE_MS = 1200
const FRAMES = [0, 1]

/**
 * Photo d'un exercice : départ et arrivée en alternance, deux points disent l'image
 * affichée. Cadre blanc dans les deux thèmes car les photos sont sur fond blanc,
 * `contain` car leurs formats varient. Rien sans photo. À monter avec `key={slug}`.
 */
const ExercisePhoto = ({ slug, sx }) => {
  const hasPhoto = Boolean(photoUrl(slug, 0))
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!hasPhoto) return undefined
    const id = setInterval(() => setFrame((f) => 1 - f), ALTERNATE_MS)
    return () => clearInterval(id)
  }, [hasPhoto])

  if (!hasPhoto) return null

  return (
    <Box
      aria-hidden="true"
      sx={{ position: 'relative', width: '100%', borderRadius: radius.inner, overflow: 'hidden', flexShrink: 0, bgcolor: '#ffffff', ...sx }}
    >
      {FRAMES.map((f) => (
        <Box
          key={f}
          component="img"
          src={photoUrl(slug, f)}
          alt=""
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            opacity: frame === f ? 1 : 0, transition: transition('opacity', DURATION.fade), ...sansMouvement(),
          }}
        />
      ))}
      <Box sx={{ position: 'absolute', bottom: space[8], left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: space[8] }}>
        {FRAMES.map((f) => (
          <Box key={f} sx={{ width: '7px', height: '7px', borderRadius: radius.pill, bgcolor: frame === f ? 'ink' : 'track' }} />
        ))}
      </Box>
    </Box>
  )
}

export default ExercisePhoto
