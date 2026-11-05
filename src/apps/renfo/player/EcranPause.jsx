import { Box, Typography } from '@mui/material'
import { space, textStyles } from '../../../styles/tokens'
import Bouton from '../../../ui/Bouton'
import { formatClock } from '../dates'
import BarreDecompte from './BarreDecompte'
import { estRecuperation, pauseContext, pauseTitle } from './labels'

const titreSx = { fontSize: '22px', lineHeight: '26px', fontWeight: 700 }
const reglageSx = { ...textStyles['corps-fort'], flex: '0 0 72px', px: 0 }

/**
 * Écran d'une pause (préparation, transition, récupération) : titre et contexte,
 * décompte, -15 s et +15 s sur une récupération seulement, barre sans transition,
 * puis la carte « Ensuite » (`carte`). `commandes` : les boutons, en bas en portrait,
 * sous la colonne de gauche en paysage, la carte à droite.
 */
const EcranPause = ({ step, restant, fraction, paysage, onMoins, onPlus, carte, commandes }) => {
  const reglable = estRecuperation(step)
  const decompte = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: space[8] }}>
      <Typography component="span" sx={{ ...textStyles['chiffre-player-moyen'], flex: '1 1 0', fontVariantNumeric: 'tabular-nums' }}>
        {formatClock(restant)}
      </Typography>
      {reglable && (
        <>
          <Bouton variante="chip" niveau="page" onClick={onMoins} aria-label="15 secondes de moins" sx={reglageSx}>-15 s</Bouton>
          <Bouton variante="chip" niveau="page" onClick={onPlus} aria-label="15 secondes de plus" sx={reglageSx}>+15 s</Bouton>
        </>
      )}
    </Box>
  )

  if (paysage) {
    return (
      <Box sx={{ display: 'flex', gap: space[24], flex: '1 1 0', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], flex: '1 1 0', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: space[12] }}>
            <Typography component="h2" sx={titreSx}>{pauseTitle(step)}</Typography>
            <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>{pauseContext(step)}</Typography>
          </Box>
          {decompte}
          <BarreDecompte fraction={fraction} />
          <Box sx={{ flex: '1 1 0' }} />
          {commandes}
        </Box>
        {carte && <Box sx={{ display: 'flex', width: '340px', flexShrink: 0, minHeight: 0, alignItems: 'flex-start' }}>{carte}</Box>}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[16], flex: '1 1 0', minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12], flex: '1 1 0', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <Typography component="h2" sx={titreSx}>{pauseTitle(step)}</Typography>
          <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>{pauseContext(step)}</Typography>
        </Box>
        {decompte}
        <BarreDecompte fraction={fraction} />
        {carte}
      </Box>
      {commandes}
    </Box>
  )
}

export default EcranPause
