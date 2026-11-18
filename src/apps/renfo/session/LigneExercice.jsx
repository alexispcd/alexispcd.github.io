import { Box, ButtonBase, Typography } from '@mui/material'
import { border, size, space } from '../../../styles/tokens'
import { ChevronDroit } from '../../../ui/Icones'
import { ligneBouton } from '../compose/ligne'

/**
 * Exercice d'un bloc déplié de Modifier : ligne de 64 px décalée de 24 sous un filet,
 * nom en corps-fort, dose en secondaire, chevron vers la fiche. Toute la ligne ouvre la fiche.
 */
const LigneExercice = ({ nom, dose, onClick }) => (
  <ButtonBase
    aria-label={`Ouvrir la fiche : ${nom}`}
    onClick={onClick}
    sx={{
      ...ligneBouton,
      ml: space[24],
      width: `calc(100% - ${space[24]})`,
      minHeight: size.ligneDouble,
      py: space[8],
      borderTop: `${border.filet} solid`,
      borderColor: 'line',
    }}
  >
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2], flex: '1 1 0', minWidth: 0 }}>
      <Typography variant="corps-fort" component="span">{nom}</Typography>
      <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{dose}</Typography>
    </Box>
    <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
  </ButtonBase>
)

export default LigneExercice
