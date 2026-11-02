import { ButtonBase } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'

/**
 * Pastille à cocher (douleurs de la page « Valider la séance ») : vrai bouton de
 * 44 px, `aria-pressed`. Plusieurs peuvent être choisies. Choisie : fond ink, texte
 * on-ink ; sinon fond chip, texte ink.
 */
const PastilleACocher = ({ choisie = false, children, sx, ...rest }) => (
  <ButtonBase
    aria-pressed={choisie}
    sx={{
      ...textStyles.secondaire,
      fontWeight: 600,
      height: size.cible,
      px: space[12],
      flexShrink: 0,
      whiteSpace: 'nowrap',
      borderRadius: radius.pill,
      bgcolor: choisie ? 'ink' : 'chip',
      color: choisie ? 'on-ink' : 'ink',
      transition: transition(['background-color', 'color'], DURATION.fade),
      ...sansMouvement(),
      ...focusContour,
      ...sx,
    }}
    {...rest}
  >
    {children}
  </ButtonBase>
)

export default PastilleACocher
