import { Box, ButtonBase, Typography } from '@mui/material'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import {
  DURATION_MAX_SEC, DURATION_MIN_SEC, REPS_MAX, REPS_MIN,
} from '../../../../supabase/functions/_shared/strength/rules.ts'
import { avecRetour, DURATION, transition } from '../../../styles/motion'
import { border, radius, size, space, textStyles } from '../../../styles/tokens'
import Compteur from '../../../ui/Compteur'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import { focusContour, sansMouvement } from '../../../ui/appui'
import { formatKg, textOnColor } from '../bandColor'

const PAS_DUREE = 5

const bandeSx = (couleur, choisie) => ({
  ...textStyles['corps-fort'],
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  minWidth: '58px',
  height: size.cible,
  px: space[12],
  boxSizing: 'border-box',
  borderRadius: radius.pill,
  bgcolor: couleur,
  color: textOnColor(couleur),
  border: choisie ? `${border.selection} solid` : `${border.filet} solid`,
  borderColor: choisie ? 'ink' : 'line',
  transition: avecRetour(transition('border-color', DURATION.fade)),
  ...sansMouvement(),
  ...focusContour,
})

/**
 * Réglage d'un exercice (FeuilleFlottante, usage réglage) : « Répétitions » ou
 * « Durée » par pas de 5 s, puis les élastiques du compte si l'exercice en utilise un.
 * Ligne « Enregistrer », second bloc « Annuler ».
 * - slug, valeur ({ quantite, kg }) et onChange : réglage tenu par le parent.
 * - onEnregistrer : appelé seul (la ligne ne ferme pas la feuille d'elle-même).
 * - onAnnuler : « Annuler » et le voile, retour à la fiche.
 */
const AjusterExercice = ({ ouverte, slug, valeur, onChange, bands = [], onEnregistrer, onAnnuler }) => {
  const ex = slug ? EXERCISE_INDEX[slug] : null
  const duree = ex?.mode === 'duration'
  const avecBande = Boolean(ex?.equipment.includes('band')) && bands.length > 0

  return (
    <FeuilleFlottante
      ouverte={ouverte && Boolean(ex) && Boolean(valeur)}
      onFermer={onAnnuler}
      libelleAria={ex ? `Ajuster ${ex.name}` : 'Ajuster'}
      fermerLibelle="Annuler"
      lignes={[{ libelle: 'Enregistrer', onClick: onEnregistrer, sansFermer: true }]}
    >
      {ex && valeur && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[14], p: space[16], textAlign: 'left' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
            <Typography component="h2" sx={{ ...textStyles['titre-barre'], fontWeight: 700 }}>Ajuster</Typography>
            <Typography variant="secondaire" sx={{ color: 'muted' }}>{ex.name}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12], borderTop: `${border.filet} solid`, borderColor: 'line', pt: space[12] }}>
            {duree ? (
              <Compteur
                libelle="Durée"
                valeur={valeur.quantite}
                min={DURATION_MIN_SEC}
                max={DURATION_MAX_SEC}
                pas={PAS_DUREE}
                formater={(v) => `${v} s`}
                onChange={(v) => onChange({ ...valeur, quantite: v })}
                labelMoins="5 secondes de moins"
                labelPlus="5 secondes de plus"
                sx={{ minHeight: size.cible }}
              />
            ) : (
              <Compteur
                libelle="Répétitions"
                valeur={valeur.quantite}
                min={REPS_MIN}
                max={REPS_MAX}
                onChange={(v) => onChange({ ...valeur, quantite: v })}
                labelMoins="Une répétition de moins"
                labelPlus="Une répétition de plus"
                sx={{ minHeight: size.cible }}
              />
            )}
            {avecBande && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="corps">Élastique</Typography>
                  {ex.assist && (
                    <Typography variant="legende" sx={{ color: 'muted' }}>plus il est fort, plus tu es aidé</Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
                  {bands.map((b) => {
                    const choisie = Number(b.kg) === Number(valeur.kg)
                    return (
                      <ButtonBase
                        key={b.id ?? b.kg}
                        aria-label={`Élastique ${formatKg(b.kg)} kg`}
                        aria-pressed={choisie}
                        onClick={() => onChange({ ...valeur, kg: Number(b.kg) })}
                        sx={bandeSx(b.color, choisie)}
                      >
                        {`${formatKg(b.kg)} kg`}
                      </ButtonBase>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </FeuilleFlottante>
  )
}

export default AjusterExercice
