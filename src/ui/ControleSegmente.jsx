import { Box, ButtonBase } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, avecRetour, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'

/**
 * Choix exclusif entre 2 à 4 options courtes. Conteneur chip, marge 4 px,
 * radius-controle (4 + radius-inner) ; segments de même largeur, 44 px, radius-inner.
 * L'option choisie est en fond ink (fondu de 150 ms, sans glisser), marquée par
 * `aria-pressed`.
 * - options : [{ valeur, libelle }] ou chaînes.
 * - label : nom du groupe pour le lecteur d'écran.
 */
const ControleSegmente = ({ options, valeur, onChange, label, sx }) => (
  <Box
    role="group"
    aria-label={label}
    sx={{
      display: 'flex',
      gap: space[4],
      p: space[4],
      borderRadius: radius.controle,
      bgcolor: 'chip',
      ...sx,
    }}
  >
    {options.map((o) => {
      const opt = typeof o === 'object' ? o : { valeur: o, libelle: o }
      const choisie = opt.valeur === valeur
      return (
        <ButtonBase
          key={opt.valeur}
          aria-pressed={choisie}
          onClick={() => onChange?.(opt.valeur)}
          sx={{
            ...textStyles.corps,
            fontWeight: 600,
            flex: '1 1 0',
            minWidth: 0,
            height: size.cible,
            borderRadius: radius.inner,
            bgcolor: choisie ? 'ink' : 'transparent',
            color: choisie ? 'on-ink' : 'ink',
            transition: avecRetour(transition(['background-color', 'color'], DURATION.fade)),
            ...sansMouvement(),
            ...focusContour,
          }}
        >
          {opt.libelle}
        </ButtonBase>
      )
    })}
  </Box>
)

export default ControleSegmente
