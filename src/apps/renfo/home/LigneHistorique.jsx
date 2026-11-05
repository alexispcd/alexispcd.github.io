import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space } from '../../../styles/tokens'
import { focusContour } from '../../../ui/appui'
import { ChevronDroit } from '../../../ui/Icones'

/**
 * Carte-ligne « Historique des séances » de l'accueil Renfo : 64 px, titre et
 * sous-ligne (séances du mois), chevron. Toute la carte se touche (calque du thème).
 */
const LigneHistorique = ({ sousLigne, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: space[12], width: '100%', minHeight: size.ligneDouble,
      py: space[14], px: space[16], boxSizing: 'border-box', justifyContent: 'flex-start', textAlign: 'left',
      bgcolor: 'surface', color: 'ink', borderRadius: radius.card,
      ...focusContour,
    }}
  >
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
      <Typography variant="corps-fort" component="span">Historique des séances</Typography>
      <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{sousLigne}</Typography>
    </Box>
    <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
  </ButtonBase>
)

export default LigneHistorique
