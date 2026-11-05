import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../../../styles/tokens'
import { focusContour } from '../../../ui/appui'
import { ChevronDroit } from '../../../ui/Icones'

/**
 * Nom de l'exercice en cours, en `titre-player` (24 px en paysage), suivi d'un chevron :
 * il ouvre la fiche de l'exercice.
 */
const NomExercice = ({ nom, paysage = false, onClick }) => (
  <ButtonBase
    onClick={onClick}
    aria-label={`Voir la fiche de ${nom}`}
    sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: space[8], alignSelf: 'flex-start',
      maxWidth: '100%', minHeight: size.cible, textAlign: 'left', color: 'ink', borderRadius: radius.inner, flexShrink: 0,
      ...focusContour,
    }}
  >
    <Typography
      component="span"
      sx={{ ...textStyles['titre-player'], ...(paysage ? { fontSize: '24px', lineHeight: '28px' } : {}), minWidth: 0 }}
    >
      {nom}
    </Typography>
    <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={18} /></Box>
  </ButtonBase>
)

export default NomExercice
