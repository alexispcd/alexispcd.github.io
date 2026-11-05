import { Box, Typography } from '@mui/material'
import { space, textStyles } from '../../../styles/tokens'
import { formatClock } from '../dates'
import PastillesExercice from '../session/PastillesExercice'
import BarreDecompte from './BarreDecompte'
import LigneCote from './LigneCote'
import NomExercice from './NomExercice'

const unite = { ...textStyles['titre-barre'], color: 'muted' }

/**
 * Écran d'un exercice dans le player, sans photo : nom (ouvre la fiche), pastilles de
 * matériel, puis les répétitions (« 12 rép. », côté « Gauche · 1 / 2 ») ou le décompte
 * (« sur 0:50 », « en pause · sur 0:50 » et le chiffre en muted, barre sans transition).
 * `commandes` : les boutons, sous le contenu en portrait, à droite en paysage.
 */
const EcranExercice = ({ step, kg, bands, enPause, restant, fraction, paysage, onFiche, commandes }) => {
  const chrono = step.advance === 'auto'
  const valeur = chrono ? formatClock(restant) : String(step.reps)
  const sous = chrono ? `${enPause ? 'en pause · ' : ''}sur ${formatClock(step.duration_sec)}` : 'rép.'
  const nom = step.exercise?.name ?? step.slug
  const pastilles = <PastillesExercice slug={step.slug} kg={kg} bands={bands} />

  if (paysage) {
    return (
      <Box sx={{ display: 'flex', gap: space[24], flex: '1 1 0', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], flex: '1 1 0', minWidth: 0, minHeight: 0 }}>
          <NomExercice nom={nom} paysage onClick={onFiche} />
          {pastilles}
          <Box sx={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: space[12], minHeight: 0 }}>
            <Typography
              component="span"
              sx={{ ...textStyles['chiffre-player-moyen'], fontVariantNumeric: 'tabular-nums', color: chrono && enPause ? 'muted' : 'ink' }}
            >
              {valeur}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], flex: '1 1 0', minWidth: 0 }}>
              <Typography component="span" sx={{ ...unite, fontVariantNumeric: 'tabular-nums' }}>{sous}</Typography>
              <LigneCote side={step.side} />
              {chrono && <BarreDecompte fraction={fraction} />}
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '300px', flexShrink: 0 }}>
          {commandes}
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[16], flex: '1 1 0', minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12], flex: '1 1 0', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none' }}>
        <NomExercice nom={nom} onClick={onFiche} />
        {pastilles}
        <Box sx={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space[12] }}>
          {chrono ? (
            <>
              <Typography
                component="span"
                sx={{ ...textStyles['chiffre-player'], fontVariantNumeric: 'tabular-nums', color: enPause ? 'muted' : 'ink' }}
              >
                {valeur}
              </Typography>
              <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{sous}</Typography>
              <LigneCote side={step.side} />
              <BarreDecompte fraction={fraction} />
            </>
          ) : (
            <>
              <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: space[8] }}>
                <Typography component="span" sx={{ ...textStyles['chiffre-player'], fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
                <Typography component="span" sx={unite}>{sous}</Typography>
              </Box>
              <LigneCote side={step.side} />
            </>
          )}
        </Box>
      </Box>
      {commandes}
    </Box>
  )
}

export default EcranExercice
