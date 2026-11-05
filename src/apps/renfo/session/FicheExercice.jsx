import { Box, ButtonBase, Typography } from '@mui/material'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { border, radius, size, space, textStyles } from '../../../styles/tokens'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import { ChevronDroit } from '../../../ui/Icones'
import { appuiLigne, focusContourInterieur } from '../../../ui/appui'
import { bandOf, photoUrl } from '../content'
import { ligneDose } from './seance'
import PastillesExercice from './PastillesExercice'

const filet = `${border.filet} solid`

const ligneDoseSx = {
  display: 'flex',
  alignItems: 'center',
  gap: space[8],
  width: '100%',
  minHeight: size.ligne,
  py: space[4],
  justifyContent: 'flex-start',
  textAlign: 'left',
  color: 'ink',
  borderTop: filet,
  borderBottom: filet,
  borderColor: 'line',
  ...appuiLigne,
  ...focusContourInterieur,
}

// Rendus internes (fonctions, pas des composants : un composant par fichier).
const photo = (src, legende) => (
  <Box key={legende} sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[4], alignItems: 'center' }}>
    <Box sx={{ width: '100%', aspectRatio: '4 / 3', borderRadius: radius.inner, overflow: 'hidden', bgcolor: '#ffffff' }}>
      <Box component="img" src={src} alt={legende} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </Box>
    <Typography variant="legende" sx={{ color: 'muted' }}>{legende}</Typography>
  </Box>
)

const section = (etiquette, texte) => (
  <Box key={etiquette} sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
    <Typography variant="etiquette" component="h3" sx={{ color: 'muted' }}>{etiquette}</Typography>
    <Typography variant="corps">{texte}</Typography>
  </Box>
)

/**
 * Fiche d'un exercice de la page séance, en FeuilleFlottante (usage fiche) : nom,
 * pastilles, ligne de dose avec « Ajuster », photos, Installation, Mouvement, Conseil,
 * puis « Remplacer l'exercice » et « Fermer ».
 * - cible : { dose, block } de l'exercice, gardée par le parent pendant la fermeture.
 * - modifiable : séance à faire au nouveau format ; sinon ni dose ni « Remplacer ».
 */
const FicheExercice = ({ ouverte, onFermer, cible, bandsUsed, bands, modifiable, onAjuster, onRemplacer }) => {
  const dose = cible?.dose
  const ex = dose ? EXERCISE_INDEX[dose.slug] : null
  const depart = dose ? photoUrl(dose.slug, 0) : null

  return (
    <FeuilleFlottante
      ouverte={ouverte && Boolean(ex)}
      onFermer={onFermer}
      libelleAria={ex ? `Fiche de l'exercice ${ex.name}` : "Fiche de l'exercice"}
      lignes={modifiable ? [{ libelle: "Remplacer l'exercice", onClick: onRemplacer }] : []}
    >
      {ex && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12], p: space[16], textAlign: 'left' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
            <Typography component="h2" sx={{ ...textStyles['titre-barre'], fontWeight: 700 }}>{ex.name}</Typography>
            <PastillesExercice slug={dose.slug} kg={bandOf(dose, bandsUsed)} bands={bands} />
          </Box>
          {modifiable && (
            <ButtonBase aria-label="Ajuster l'exercice" onClick={onAjuster} sx={ligneDoseSx}>
              <Typography variant="corps-fort" component="span" sx={{ flex: '1 1 0', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>
                {ligneDose(dose, bandsUsed, cible.block)}
              </Typography>
              <Typography variant="corps-fort" component="span">Ajuster</Typography>
              <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
            </ButtonBase>
          )}
          {depart && (
            <Box sx={{ display: 'flex', gap: space[12] }}>
              {photo(depart, 'Départ')}
              {photo(photoUrl(dose.slug, 1), 'Arrivée')}
            </Box>
          )}
          {ex.setup && section('Installation', ex.setup)}
          {section('Mouvement', ex.description)}
          {section('Conseil', ex.tip)}
        </Box>
      )}
    </FeuilleFlottante>
  )
}

export default FicheExercice
