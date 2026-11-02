import { ButtonBase } from '@mui/material'
import { radius, size, textStyles } from '../styles/tokens'
import { focusContour } from './appui'

/**
 * Bouton carré de 44 px qui ne porte qu'une icône (22 px, 20 pour la croix), ou
 * l'initiale du compte avec `compte` (fond chip, 15 px gras). `label` est
 * obligatoire : il dit l'action (« Retour à l'accueil », « Mon compte »).
 * Le calque d'appui du thème se pose sur la zone ronde de 44 px.
 */
const BoutonIcone = ({ label, compte = false, children, sx, ...rest }) => (
  <ButtonBase
    aria-label={label}
    sx={{
      width: size.cible,
      height: size.cible,
      flexShrink: 0,
      borderRadius: radius.pill,
      color: 'ink',
      bgcolor: compte ? 'chip' : 'transparent',
      ...(compte ? { ...textStyles['corps-fort'], fontWeight: 700 } : {}),
      ...focusContour,
      ...sx,
    }}
    {...rest}
  >
    {children}
  </ButtonBase>
)

export default BoutonIcone
