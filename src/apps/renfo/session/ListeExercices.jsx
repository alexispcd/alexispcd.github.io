import { Box, ButtonBase, Typography } from '@mui/material'
import { border, radius, size, space } from '../../../styles/tokens'
import Carte from '../../../ui/Carte'
import { ligneBouton } from '../compose/ligne'
import ExerciseThumb from './ExerciseThumb'
import PastillesExercice from './PastillesExercice'

/**
 * Liste « Ajouter un exercice » et « Remplacer » (lot R7), partagée par la page
 * Remplacer de la séance et par Modifier : titre, sous-ligne, puis une carte par
 * section (étiquette facultative), une ligne de 64 px par exercice (vignette, nom,
 * pastilles de matériel). Contenu seul : la page qui l'affiche pose le conteneur.
 * - sections : [{ cle, titre (ou null), exercices: [Exercise] }].
 * - onChoisir(slug) ; desactive : lignes ignorées (remplacement en cours).
 */
const ListeExercices = ({ titre, sousLigne, sections, onChoisir, desactive = false }) => (
  <>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], px: space[4] }}>
      <Typography variant="titre-section" component="h1" sx={{ textWrap: 'balance' }}>{titre}</Typography>
      <Typography variant="secondaire" sx={{ color: 'muted' }}>{sousLigne}</Typography>
    </Box>
    {sections.length ? sections.map((section) => (
      <Box key={section.cle} component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
        {section.titre && (
          <Typography variant="etiquette" component="h2" sx={{ color: 'muted', px: space[4] }}>{section.titre}</Typography>
        )}
        <Carte sx={{ py: space[4], px: space[16], gap: 0 }}>
          {section.exercices.map((ex, i) => (
            <ButtonBase
              key={ex.slug}
              disabled={desactive}
              onClick={() => onChoisir(ex.slug)}
              sx={{
                ...ligneBouton,
                minHeight: size.ligneDouble,
                py: space[8],
                borderTop: i > 0 ? `${border.filet} solid` : 'none',
                borderColor: 'line',
                '&.Mui-disabled': { color: 'ink' },
              }}
            >
              <ExerciseThumb slug={ex.slug} size={40} radius={radius.inner} sansContour />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], flex: '1 1 0', minWidth: 0 }}>
                <Typography variant="corps-fort" component="span">{ex.name}</Typography>
                <PastillesExercice slug={ex.slug} bandeGenerique />
              </Box>
            </ButtonBase>
          ))}
        </Carte>
      </Box>
    )) : (
      <Typography variant="secondaire" sx={{ color: 'muted', px: space[4] }}>
        Aucun autre exercice possible avec ton matériel.
      </Typography>
    )}
  </>
)

export default ListeExercices
