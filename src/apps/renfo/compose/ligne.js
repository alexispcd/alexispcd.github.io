import { space } from '../../../styles/tokens'
import { appuiLigne, focusContourInterieur } from '../../../ui/appui'

/** Ligne touchable de la carte « Ta séance » : pleine largeur, calque de ligne, texte à gauche. */
export const ligneBouton = {
  display: 'flex',
  alignItems: 'center',
  gap: space[12],
  width: '100%',
  textAlign: 'left',
  justifyContent: 'flex-start',
  color: 'ink',
  ...appuiLigne,
  ...focusContourInterieur,
}
