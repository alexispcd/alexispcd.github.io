import { Box, ButtonBase, Typography } from '@mui/material'
import { border, radius, size, space, textStyles } from '../styles/tokens'
import { appuiLigne, focusContourInterieur } from './appui'
import { ChevronDroit } from './Icones'

/**
 * Ligne de la liste des modules de l'Accueil : pastille de 40 px (surface,
 * radius-inner) avec l'initiale, nom en corps-fort, description en secondaire muted,
 * chevron à droite. Filet line au-dessus, ligne entière touchable (44 px au moins),
 * calque ink à 6 % à l'appui, sans changement de taille.
 */
const LigneModule = ({ nom, description, onClick, sx, ...rest }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: space[14],
      width: '100%',
      minHeight: size.cible,
      py: space[12],
      px: space[4],
      justifyContent: 'flex-start',
      textAlign: 'left',
      color: 'ink',
      borderTop: `${border.filet} solid`,
      borderColor: 'line',
      ...appuiLigne,
      ...focusContourInterieur,
      ...sx,
    }}
    {...rest}
  >
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        ...textStyles['corps-fort'],
        fontWeight: 700,
        width: '40px',
        height: '40px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.inner,
        bgcolor: 'surface',
      }}
    >
      {nom?.[0]?.toUpperCase()}
    </Box>
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: space[2], flex: '1 1 0', minWidth: 0 }}>
      <Typography variant="corps-fort" component="span">{nom}</Typography>
      {description && (
        <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>{description}</Typography>
      )}
    </Box>
    <Box component="span" sx={{ display: 'flex', color: 'muted', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
  </ButtonBase>
)

export default LigneModule
