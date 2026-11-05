import { Box, ButtonBase, Typography } from '@mui/material'
import { border, radius, space, textStyles } from '../../../styles/tokens'
import { focusContour } from '../../../ui/appui'
import { ChevronDroit } from '../../../ui/Icones'
import { MOVE_BAR_LABELS, photoUrl } from '../content'
import PastillesExercice from '../session/PastillesExercice'
import ExercisePhoto from './ExercisePhoto'
import { ensuiteLibelle, stepDoseText } from './labels'

const filet = { borderTop: `${border.filet} solid`, borderColor: 'line', pt: space[8] }

/**
 * Carte « Ensuite » d'une pause : photo de l'exercice suivant (départ et arrivée en
 * alternance), surtitre (« Ensuite · côté gauche »), nom, dose, pastilles, puis
 * l'installation sur une récupération et « Déplace la barre … » si la hauteur change.
 * Toute la carte ouvre la fiche de l'exercice suivant. Paysage : photo à gauche.
 */
const CarteEnsuite = ({ step, kg, bands, installation, moveBarTo, paysage = false, onFiche }) => {
  const nom = step.exercise?.name ?? step.slug
  const photo = Boolean(photoUrl(step.slug, 0))
  const textes = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], minWidth: 0, flex: '1 1 0' }}>
      <Typography variant="etiquette" component="span" sx={{ color: 'muted' }}>{ensuiteLibelle(step)}</Typography>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: space[8] }}>
        <Typography component="span" sx={{ ...textStyles['titre-barre'], fontWeight: 700, minWidth: 0 }}>{nom}</Typography>
        <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
      </Box>
      <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{stepDoseText(step)}</Typography>
      <PastillesExercice slug={step.slug} kg={kg} bands={bands} />
      {installation && step.exercise?.setup && (
        <Typography variant="corps" component="span" sx={filet}>{step.exercise.setup}</Typography>
      )}
      {moveBarTo && (
        <Typography variant="corps-fort" component="span" sx={filet}>{MOVE_BAR_LABELS[moveBarTo]}</Typography>
      )}
    </Box>
  )

  return (
    <ButtonBase
      onClick={onFiche}
      aria-label={`Voir la fiche de ${nom}`}
      sx={{
        display: 'flex', flexDirection: paysage ? 'row' : 'column', alignItems: 'stretch', justifyContent: 'flex-start',
        gap: paysage ? space[12] : space[8], p: paysage ? space[12] : space[14], width: '100%', boxSizing: 'border-box',
        textAlign: 'left', color: 'ink', bgcolor: 'surface', borderRadius: radius.card, flexShrink: 0,
        ...focusContour,
      }}
    >
      {photo && (
        <ExercisePhoto
          key={step.slug}
          slug={step.slug}
          sx={paysage ? { width: '130px', flex: 'none', minHeight: '120px' } : { height: '170px' }}
        />
      )}
      {textes}
    </ButtonBase>
  )
}

export default CarteEnsuite
