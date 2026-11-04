import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import BoutonIcone from '../ui/BoutonIcone'
import FeuilleFlottante from '../ui/FeuilleFlottante'
import { ChevronRetour, TroisPoints } from '../ui/Icones'
import { space } from '../styles/tokens'

// Hauteur de la barre du haut, sous l'inset haut de l'iPhone. Lue par les pages
// pour leur marge haute.
export const HEADER_HEIGHT = 60

// Bord des boutons de 44 px : l'icône de 22 px tombe à 16 px du bord, comme la marge
// de -10 px des planches (16 - 10 = 6).
const BORD = `calc(${space[16]} - 10px)`

/**
 * Barre du haut des pages de module : chevron retour et titre à gauche, trois points
 * à droite seulement s'il y a des actions. Fond plein posé par App.jsx derrière.
 * - titre : titre-barre, coupé s'il est long.
 * - onBack : chevron affiché seulement s'il est fourni (label « Retour »).
 * - actions : [{ label, onClick, disabled }], une ligne par action dans une
 *   FeuilleFlottante (second bloc « Fermer ») ; titreActions : son titre facultatif.
 * La feuille se ferme au changement de route.
 */
const AppHeader = ({ titre, actions = [], titreActions, onBack, sx = {} }) => {
  const [ouverte, setOuverte] = useState(false)

  // AppHeader n'est jamais démonté : ajustement pendant le rendu plutôt qu'un effet,
  // pas de rendu intermédiaire avec la feuille ouverte sur la nouvelle page.
  const { pathname } = useLocation()
  const [cheminFeuille, setCheminFeuille] = useState(pathname)
  if (cheminFeuille !== pathname) {
    setCheminFeuille(pathname)
    setOuverte(false)
  }

  const aDesActions = actions.length > 0

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8],
      height: `${HEADER_HEIGHT}px`, px: BORD, boxSizing: 'content-box',
      pointerEvents: 'none',
      ...sx,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, pointerEvents: 'auto' }}>
        {onBack && (
          <BoutonIcone label="Retour" onClick={onBack}>
            <ChevronRetour taille={22} />
          </BoutonIcone>
        )}
        {titre && (
          <Typography variant="titre-barre" noWrap sx={{ minWidth: 0, ml: onBack ? 0 : '10px' }}>
            {titre}
          </Typography>
        )}
      </Box>

      {aDesActions && (
        <Box sx={{ display: 'flex', pointerEvents: 'auto' }}>
          <BoutonIcone label="Actions" onClick={() => setOuverte(true)}>
            <TroisPoints taille={22} />
          </BoutonIcone>
        </Box>
      )}

      <FeuilleFlottante
        ouverte={ouverte && aDesActions}
        onFermer={() => setOuverte(false)}
        titre={titreActions || undefined}
        lignes={actions.map((a) => ({ libelle: a.label, onClick: a.onClick, disabled: a.disabled }))}
      />
    </Box>
  )
}

export default AppHeader
