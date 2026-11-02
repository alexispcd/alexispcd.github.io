import { Box } from '@mui/material'
import { border, radius } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { sansMouvement } from './appui'

// Toutes les formes sont superposées : on passe de l'une à l'autre par un fondu de
// 150 ms, sauf le disque de « faite » qui grandit depuis le centre (220 ms) et se
// retire en 180 ms.
const calque = (visible) => ({
  position: 'absolute',
  boxSizing: 'border-box',
  opacity: visible ? 1 : 0,
  transition: transition('opacity', DURATION.fade),
  ...sansMouvement(),
})

/**
 * Marque d'une séance, 10 px. La forme dit l'état, la couleur l'intensité.
 * - etat : 'faite' (disque), 'aFaire' (cercle), 'adaptee' (pointillés), 'sautee'
 *   (cercle barré), 'aucune' (petit point track, pas de séance), 'course' (losange
 *   ink de 8 px, jour de course ou jalon).
 * - zone : 'facile', 'qualite', 'longue', ou 'ink' pour Renfo.
 * - label : nom pour le lecteur d'écran ; sans label, la marque est décorative.
 */
const MarqueSeance = ({ etat = 'aFaire', zone = 'facile', label, sx }) => {
  const couleur = zone === 'ink' ? 'ink' : `zone-${zone}`
  const faite = etat === 'faite'
  const cercle = faite || etat === 'aFaire' || etat === 'sautee'
  return (
    <Box
      component="span"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      sx={{ position: 'relative', display: 'inline-block', flexShrink: 0, width: '10px', height: '10px', ...sx }}
    >
      <Box component="span" sx={{ ...calque(cercle), inset: 0, borderRadius: radius.pill, border: `${border.contour} solid`, borderColor: couleur }} />
      <Box component="span" sx={{ ...calque(etat === 'adaptee'), inset: 0, borderRadius: radius.pill, border: `${border.contour} dashed`, borderColor: couleur }} />
      <Box
        component="span"
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius.pill,
          bgcolor: couleur,
          transform: faite ? 'scale(1)' : 'scale(0)',
          transition: transition('transform', faite ? DURATION.open : DURATION.close),
          ...sansMouvement(),
        }}
      />
      <Box
        component="span"
        sx={{
          ...calque(etat === 'sautee'),
          top: '50%',
          left: '-1px',
          right: '-1px',
          height: border.contour,
          mt: `calc(${border.contour} / -2)`,
          bgcolor: couleur,
          transform: 'rotate(-45deg)',
        }}
      />
      <Box component="span" sx={{ ...calque(etat === 'aucune'), top: '3px', left: '3px', width: '4px', height: '4px', borderRadius: radius.pill, bgcolor: 'track' }} />
      <Box component="span" sx={{ ...calque(etat === 'course'), top: '1px', left: '1px', width: '8px', height: '8px', bgcolor: 'ink', transform: 'rotate(45deg)' }} />
    </Box>
  )
}

export default MarqueSeance
