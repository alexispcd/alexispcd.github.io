import { Box, ButtonBase, Typography } from '@mui/material'
import { border, size, space } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import { sansMouvement } from '../../../ui/appui'
import { ChevronBas } from '../../../ui/Icones'
import Depli from './Depli'
import { ligneBouton } from './ligne'

const numeroSx = { width: '14px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }

/**
 * Un bloc de la carte « Ta séance », en accordéon (superset, échauffement, retour au
 * calme). Replié : numéro, titre, sous-ligne et chevron vers le bas. Déplié : la
 * sous-ligne se referme, le chevron fait un demi-tour, puis le contenu (children).
 * - numero : chaîne vide pour un bloc sans numéro (la colonne reste, pour l'alignement).
 * - present : faux, la ligne se referme puis onExited la retire de la liste ;
 *   apparait : ligne ajoutée, ouverte en fondu.
 * - refBouton, decritPar : le bouton de l'en-tête (focus) et l'id de ce qui le décrit.
 */
const LigneBloc = ({
  numero = '', titre, sousLigne, ouvert, present = true, apparait = false,
  onBasculer, onExited, refBouton, decritPar, children,
}) => {
  const duree = ouvert ? DURATION.open : DURATION.close
  return (
    <Depli ouvert={present} appear={apparait} onExited={onExited}>
      <Box sx={{ borderTop: `${border.filet} solid`, borderColor: 'line' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
          <Typography variant="corps-fort" component="span" sx={{ ...numeroSx, color: 'muted' }}>{numero}</Typography>
          <ButtonBase
            ref={refBouton}
            aria-expanded={ouvert}
            aria-describedby={decritPar}
            onClick={onBasculer}
            sx={{ ...ligneBouton, gap: space[8], flex: '1 1 0', minWidth: 0, minHeight: size.cible, py: space[12] }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
              <Typography variant="corps-fort" component="span">{titre}</Typography>
              <Depli ouvert={!ouvert}>
                <Typography
                  variant="secondaire"
                  component="span"
                  sx={{
                    display: 'block', color: 'muted', fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {sousLigne}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', pb: space[12] }}>{children}</Box>
        </Depli>
      </Box>
    </Depli>
  )
}

export default LigneBloc
