import { Box, Typography } from '@mui/material'
import { size, space } from '../../../styles/tokens'
import BoutonIcone from '../../../ui/BoutonIcone'
import { TroisPoints } from '../../../ui/Icones'

/**
 * En-tête du player : titre de la séance, temps écoulé dessous, trois points à droite
 * (son, plan, quitter). `children` se pose entre les deux (la progression en paysage).
 * Sans `onMenu`, pas de trois points.
 */
const EnTetePlayer = ({ titre, temps, onMenu, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: space[16], minHeight: size.cible, flexShrink: 0 }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: children ? '0 1 auto' : '1 1 auto' }}>
      <Typography variant="corps-fort" noWrap>{titre}</Typography>
      {temps && (
        <Typography variant="legende" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{temps}</Typography>
      )}
    </Box>
    {children && <Box sx={{ flex: '1 1 0', minWidth: 0 }}>{children}</Box>}
    {onMenu && (
      <BoutonIcone label="Son, plan, quitter" onClick={onMenu} sx={{ mr: '-10px' }}>
        <TroisPoints taille={22} />
      </BoutonIcone>
    )}
  </Box>
)

export default EnTetePlayer
