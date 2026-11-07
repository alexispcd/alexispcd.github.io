import { radius, space } from '../styles/tokens'
import { focusContour } from './appui'

// Gabarit commun des widgets de l'Accueil : 170 px, surface, radius-card, marge 16.
export const WIDGET_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  gap: space[8],
  height: '170px',
  minWidth: 0,
  p: space[16],
  boxSizing: 'border-box',
  bgcolor: 'surface',
  color: 'ink',
  borderRadius: radius.card,
  textAlign: 'left',
  ...focusContour,
}
