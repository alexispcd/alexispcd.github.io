import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { focusContour } from './appui'
import { Moins, Plus } from './Icones'

const bouton = {
  width: size.cible,
  height: size.cible,
  flexShrink: 0,
  borderRadius: radius.pill,
  bgcolor: 'chip',
  color: 'ink',
  // À une borne : icône muted et vrai `disabled` (hors du seuil de contraste, assumé).
  '&.Mui-disabled': { color: 'muted' },
  ...focusContour,
}

/**
 * Règle une petite valeur entière sur une ligne : libellé, moins, valeur en 17 px
 * gras tabulaire, plus. La valeur change d'un coup.
 * - labelMoins, labelPlus : l'action de chaque bouton (« Un tour de moins »).
 * - pas : écart d'un appui (1 par défaut, 5 pour une durée en secondes).
 * - formater : texte affiché pour la valeur (« 30 s »), la valeur brute sinon.
 */
const Compteur = ({
  libelle, valeur, min = 0, max = Infinity, pas = 1, formater, onChange, labelMoins, labelPlus, sx,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: space[12], minHeight: size.ligne, ...sx }}>
    <Typography variant="corps" sx={{ flex: '1 1 0', minWidth: 0 }}>{libelle}</Typography>
    <ButtonBase
      aria-label={labelMoins}
      disabled={valeur - pas < min}
      onClick={() => onChange?.(valeur - pas)}
      sx={bouton}
    >
      <Moins taille={18} />
    </ButtonBase>
    <Typography
      component="span"
      aria-live="polite"
      sx={{
        ...textStyles['titre-barre'],
        fontWeight: 700,
        minWidth: '14px',
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formater ? formater(valeur) : valeur}
    </Typography>
    <ButtonBase
      aria-label={labelPlus}
      disabled={valeur + pas > max}
      onClick={() => onChange?.(valeur + pas)}
      sx={bouton}
    >
      <Plus taille={18} />
    </ButtonBase>
  </Box>
)

export default Compteur
