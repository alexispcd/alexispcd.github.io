import { Box } from '@mui/material'
import { radius } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { sansMouvement } from './appui'

const LARGEUR = '10px'

/**
 * Repère du côté travaillé dans le player Renfo, pour un exercice fait d'un seul côté
 * à la fois : une bande verticale `ink` de 10 px collée au bord gauche ou droit, à
 * `ecart` du haut et du bas (150 px en portrait, 70 px en paysage), coins arrondis
 * côté intérieur. À poser dans un conteneur positionné (le player, plein écran).
 * - cote : 'gauche', 'droite', ou null (deux côtés à la fois : aucune bande).
 * Les deux bandes restent montées : au changement de côté, l'une s'efface et l'autre
 * apparaît en fondu enchaîné de 150 ms, sans traverser l'écran. Décorative
 * (aria-hidden) : le texte « Gauche · 1 / 2 » porte l'information.
 */
const BandeCote = ({ cote = null, ecart = '150px' }) => (
  <>
    {['gauche', 'droite'].map((c) => (
      <Box
        key={c}
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: ecart,
          bottom: ecart,
          width: LARGEUR,
          bgcolor: 'ink',
          pointerEvents: 'none',
          ...(c === 'gauche'
            ? { left: 0, borderRadius: `0 ${radius.small} ${radius.small} 0` }
            : { right: 0, borderRadius: `${radius.small} 0 0 ${radius.small}` }),
          opacity: cote === c ? 1 : 0,
          transition: transition('opacity', DURATION.fade),
          ...sansMouvement(),
        }}
      />
    ))}
  </>
)

export default BandeCote
