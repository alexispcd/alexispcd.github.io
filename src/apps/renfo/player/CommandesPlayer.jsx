import { Box } from '@mui/material'
import { size, space, textStyles } from '../../../styles/tokens'
import Bouton from '../../../ui/Bouton'

const secondaireSx = { ...textStyles['corps-fort'], px: space[8], minWidth: 0 }
const principalSx = { ...textStyles['titre-barre'], fontWeight: 700, height: size.player }

/**
 * Commandes du player : secondaires en `chip` au niveau des cartes (« Précédent »,
 * « Passer »), puis le bouton principal de 60 px, `ink` ou `chip` (« Pause »,
 * « Passer le repos », « Commencer »).
 * - secondaires : [{ libelle, onClick }] ; principal : { libelle, variante, onClick }.
 * - disposition : 'colonne' (secondaires en rangée au-dessus du principal) ou
 *   'rangee' (paysage, pause : secondaires de 140 px à gauche du principal).
 */
const CommandesPlayer = ({ secondaires = [], principal, disposition = 'colonne', sx }) => {
  const boutons = secondaires.map((b) => (
    <Bouton
      key={b.libelle}
      variante="chip"
      niveau="page"
      onClick={b.onClick}
      sx={{ ...secondaireSx, flex: disposition === 'rangee' ? '0 0 140px' : '1 1 0' }}
    >
      {b.libelle}
    </Bouton>
  ))
  const bouton = principal && (
    <Bouton
      variante={principal.variante ?? 'ink'}
      niveau="page"
      onClick={principal.onClick}
      sx={{ ...principalSx, flex: disposition === 'rangee' ? '1 1 0' : undefined, width: disposition === 'rangee' ? 'auto' : '100%' }}
    >
      {principal.libelle}
    </Bouton>
  )

  if (disposition === 'rangee') {
    return <Box sx={{ display: 'flex', gap: space[8], flexShrink: 0, ...sx }}>{boutons}{bouton}</Box>
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], flexShrink: 0, ...sx }}>
      {boutons.length > 0 && <Box sx={{ display: 'flex', gap: space[8] }}>{boutons}</Box>}
      {bouton}
    </Box>
  )
}

export default CommandesPlayer
