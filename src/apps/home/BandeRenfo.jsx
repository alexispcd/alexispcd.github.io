import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, space, textStyles } from '../../styles/tokens'
import { focusContour } from '../../ui/appui'
import { ChevronDroit } from '../../ui/Icones'

/**
 * Bande Renfo du bloc « Aujourd'hui », pleine largeur sous les widgets : initiale « R »
 * dans un carré chip, trois lignes (ce qui se passe, le titre, le détail), chevron.
 * Toute la bande est un bouton.
 */
const BandeRenfo = ({ ligne, titre, detail, onClick, label }) => (
  <ButtonBase
    onClick={onClick}
    aria-label={label}
    sx={{
      gridColumn: '1 / -1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: space[14],
      py: space[14],
      px: space[16],
      bgcolor: 'surface',
      color: 'ink',
      borderRadius: radius.card,
      textAlign: 'left',
      ...focusContour,
    }}
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
        bgcolor: 'chip',
      }}
    >
      R
    </Box>
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: space[2], flex: '1 1 0', minWidth: 0 }}>
      <Typography variant="legende" component="span" sx={{ fontWeight: 600, color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{ligne}</Typography>
      <Typography variant="titre-barre" component="span" sx={{ fontWeight: 700 }}>{titre}</Typography>
      {detail && <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>{detail}</Typography>}
    </Box>
    <Box component="span" sx={{ display: 'flex', color: 'muted', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
  </ButtonBase>
)

export default BandeRenfo
