import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, avecRetour, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'
import { ChevronDroit } from './Icones'

/**
 * Choix exclusif en pleine largeur, une carte par réponse. Posée au niveau des
 * cartes (radius-card), 64 px avec une sous-ligne, 52 px sans ou `compacte`.
 * Les options s'empilent à 8 px dans un groupe (`role="group"`) fourni par l'appelant.
 * - droite : `valeur` (chiffre 24 px gras), `repere` (secondaire) ou `chevron`.
 * - choisie : fond ink, tout le texte en on-ink, `aria-pressed`.
 */
const Option = ({ libelle, sousLigne, valeur, repere, chevron = false, choisie = false, compacte = false, sx, ...rest }) => {
  const avecSousLigne = Boolean(sousLigne) && !compacte
  const discret = choisie ? 'on-ink' : 'muted'
  return (
    <ButtonBase
      aria-pressed={choisie}
      sx={{
        width: '100%',
        minHeight: avecSousLigne ? size.ligneDouble : size.ligne,
        py: space[12],
        px: space[16],
        gap: space[12],
        justifyContent: 'space-between',
        textAlign: 'left',
        borderRadius: radius.card,
        bgcolor: choisie ? 'ink' : 'surface',
        color: choisie ? 'on-ink' : 'ink',
        transition: avecRetour(transition(['background-color', 'color'], DURATION.fade)),
        ...sansMouvement(),
        ...focusContour,
        ...sx,
      }}
      {...rest}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography variant="corps-fort" component="span">{libelle}</Typography>
        {avecSousLigne && (
          <Typography variant="secondaire" component="span" sx={{ color: discret }}>{sousLigne}</Typography>
        )}
      </Box>
      {valeur != null && (
        <Typography component="span" sx={{ ...textStyles.chiffre, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {valeur}
        </Typography>
      )}
      {valeur == null && repere != null && (
        <Typography variant="secondaire" component="span" sx={{ color: discret, flexShrink: 0 }}>{repere}</Typography>
      )}
      {valeur == null && repere == null && chevron && (
        <Box component="span" sx={{ display: 'flex', color: discret, flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
      )}
    </ButtonBase>
  )
}

export default Option
