import { Box, ButtonBase, Typography } from '@mui/material'
import { border, size, space } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import Compteur from '../../../ui/Compteur'
import { sansMouvement } from '../../../ui/appui'
import { ChevronBas, ChevronDroit } from '../../../ui/Icones'
import {
  GROUP_LABELS, groupOfFocus, ROUNDS_MAX, ROUNDS_MIN, SUPERSET_EXERCISES_MIN, TRISET_FOCUS_LABELS,
} from '../../../../supabase/functions/_shared/strength/rules.ts'
import Depli from './Depli'
import { ligneBouton } from './ligne'

const decale = { pl: space[24] }
const numeroSx = { width: '14px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }

/**
 * Un superset de la carte « Ta séance », en accordéon. Replié : numéro, thème, sous-ligne
 * et chevron vers le bas. Déplié : la sous-ligne se referme, le chevron fait un
 * demi-tour, puis Groupe, Exercices, Tours et « Retirer ce superset ».
 * - superset : { focus, exercise_count, rounds, retire, apparait } ; retire : la ligne
 *   se referme puis onExited la retire de la liste ; apparait : ligne ajoutée.
 * - max : exercices au plus pour le thème.
 */
const LigneSuperset = ({ numero, superset, ouvert, max, onBasculer, onGroupe, onChange, onRetirer, onExited }) => {
  const groupe = GROUP_LABELS[groupOfFocus(superset.focus)] ?? ''
  const theme = TRISET_FOCUS_LABELS[superset.focus] ?? ''
  const duree = ouvert ? DURATION.open : DURATION.close
  return (
    <Depli ouvert={!superset.retire} appear={superset.apparait} onExited={onExited}>
      <Box sx={{ borderTop: `${border.filet} solid`, borderColor: 'line' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
          <Typography variant="corps-fort" component="span" sx={{ ...numeroSx, color: 'muted' }}>{numero}</Typography>
          <ButtonBase
            aria-expanded={ouvert}
            aria-label={ouvert ? 'Replier le superset' : 'Déplier le superset'}
            onClick={onBasculer}
            sx={{ ...ligneBouton, gap: space[8], flex: '1 1 0', minWidth: 0, minHeight: size.cible, py: space[12] }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
              <Typography variant="corps-fort" component="span">{theme}</Typography>
              <Depli ouvert={!ouvert}>
                <Typography variant="secondaire" component="span" sx={{ display: 'block', color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                  {`${groupe} · ${superset.exercise_count} exercices, ${superset.rounds} tours`}
                </Typography>
              </Depli>
            </Box>
            <Box
              component="span"
              sx={{
                display: 'flex',
                flexShrink: 0,
                color: 'muted',
                transform: ouvert ? 'rotate(180deg)' : 'none',
                transition: transition('transform', duree),
                ...sansMouvement(),
              }}
            >
              <ChevronBas taille={16} />
            </Box>
          </ButtonBase>
        </Box>

        <Depli ouvert={ouvert}>
          <Box sx={{ display: 'flex', flexDirection: 'column', pb: space[12] }}>
            <ButtonBase
              aria-label="Changer le groupe du superset"
              onClick={onGroupe}
              sx={{ ...ligneBouton, ...decale, minHeight: size.ligne }}
            >
              <Typography variant="corps" component="span" sx={{ flex: '1 1 0' }}>Groupe</Typography>
              <Typography variant="corps-fort" component="span">{groupe}</Typography>
              <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
            </ButtonBase>
            <Compteur
              libelle="Exercices"
              valeur={superset.exercise_count}
              min={SUPERSET_EXERCISES_MIN}
              max={max}
              onChange={(v) => onChange({ exercise_count: v })}
              labelMoins="Un exercice de moins"
              labelPlus="Un exercice de plus"
              sx={decale}
            />
            <Compteur
              libelle="Tours"
              valeur={superset.rounds}
              min={ROUNDS_MIN}
              max={ROUNDS_MAX}
              onChange={(v) => onChange({ rounds: v })}
              labelMoins="Un tour de moins"
              labelPlus="Un tour de plus"
              sx={decale}
            />
            <ButtonBase onClick={onRetirer} sx={{ ...ligneBouton, ...decale, minHeight: size.cible, color: 'muted' }}>
              <Typography variant="corps" component="span">Retirer ce superset</Typography>
            </ButtonBase>
          </Box>
        </Depli>
      </Box>
    </Depli>
  )
}

export default LigneSuperset
