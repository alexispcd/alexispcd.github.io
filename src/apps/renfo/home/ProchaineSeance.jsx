import { Box, Typography } from '@mui/material'
import { space } from '../../../styles/tokens'
import Carte from '../../../ui/Carte'
import Pastille from '../../../ui/Pastille'
import { TRISET_FOCUS_LABELS } from '../../../../supabase/functions/_shared/strength/rules.ts'
import { resumeComposition } from '../accueil'

const themesDe = (composition) => composition.supersets
  .map((s) => TRISET_FOCUS_LABELS[s.focus])
  .filter(Boolean)

/** Carte « Prochaine séance » : la suggestion, ou la séance déjà créée et pas encore faite. */
const ProchaineSeance = ({ phrase, titre, composition, children }) => (
  <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
    <Typography variant="titre-barre" component="h2">Prochaine séance</Typography>
    <Carte sx={{ gap: space[12] }}>
      <Typography variant="secondaire" sx={{ color: 'muted' }}>{phrase}</Typography>
      <Typography variant="titre-section" component="p">{titre}</Typography>
      {composition.supersets.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
          {themesDe(composition).map((t, i) => <Pastille key={`${t}-${i}`}>{t}</Pastille>)}
        </Box>
      )}
      <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
        {resumeComposition(composition.intensity, composition.supersets.length)}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], pt: space[4] }}>
        {children}
      </Box>
    </Carte>
  </Box>
)

export default ProchaineSeance
