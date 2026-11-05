import { Box, Typography } from '@mui/material'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { border, space } from '../../../styles/tokens'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import Pastille from '../../../ui/Pastille'
import { exercicesDuBloc, rangSuperset, titreBloc } from '../session/seance'
import { etatBlocs } from './position'
import { focusStep } from './sequence'

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Plan de la séance (FeuilleFlottante usage Plan, ancrée en haut et en bas, la liste
 * défile) : « Plan de la séance », « Corps complet · ≈ 63 min », puis une ligne par
 * bloc avec son état (« Fait », « Tour 2 / 4 », « 4 tours ») et, sous le bloc en
 * cours, ses exercices : celui joué en gras avec la pastille « En cours », ceux déjà
 * faits du tour en muted. Lecture seule.
 */
const PlanSeance = ({ ouverte, onFermer, titre, minutes, content, steps, cursor, fin }) => {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const etats = etatBlocs(steps, cursor, fin)
  const focus = fin ? null : focusStep(steps, cursor)

  return (
    <FeuilleFlottante ouverte={ouverte} onFermer={onFermer} libelleAria="Plan de la séance" ancree>
      <Box sx={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2], px: space[16], pt: space[16], pb: space[12] }}>
          <Typography component="h2" variant="titre-barre" sx={{ fontWeight: 700 }}>Plan de la séance</Typography>
          <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
            {minutes != null ? `${titre} · ≈ ${minutes} min` : titre}
          </Typography>
        </Box>
        {blocks.map((block, i) => {
          const rang = rangSuperset(content, i)
          const etat = etats[i] ?? (block.type === 'superset' ? pluriel(block.rounds ?? 1, 'tour') : '')
          const enCours = focus?.blockIndex === i
          const exercices = enCours ? exercicesDuBloc(block) : []
          const courant = enCours ? exercices.findIndex((d) => d.slug === focus.slug) : -1
          return (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', borderTop: `${border.filet} solid`, borderColor: 'line', px: space[16], py: space[12] }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8] }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: space[12], minWidth: 0 }}>
                  <Typography variant="corps-fort" component="span" sx={{ width: '14px', flexShrink: 0, color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                    {rang ?? ''}
                  </Typography>
                  <Typography variant="corps-fort" component="span">{titreBloc(block)}</Typography>
                </Box>
                {etat && (
                  <Typography variant="secondaire" component="span" sx={{ color: 'muted', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{etat}</Typography>
                )}
              </Box>
              {exercices.map((dose, j) => (
                <Box
                  key={`${dose.slug}-${j}`}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: space[8], minHeight: '30px', pl: space[24],
                    color: j < courant ? 'muted' : 'ink',
                  }}
                >
                  <Typography variant="corps" component="span" sx={{ flex: '1 1 0', minWidth: 0, fontWeight: j === courant ? 700 : 400 }}>
                    {EXERCISE_INDEX[dose.slug]?.name ?? dose.slug}
                  </Typography>
                  {j === courant && <Pastille variante="enCours">En cours</Pastille>}
                </Box>
              ))}
            </Box>
          )
        })}
      </Box>
    </FeuilleFlottante>
  )
}

export default PlanSeance
