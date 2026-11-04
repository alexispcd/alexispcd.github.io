import { Box } from '@mui/material'
import BarreAttente from '../ui/BarreAttente'
import { DUREES } from '../lib/durees'

// Départ commun, pris à l'évaluation du module : la barre continue d'un montage à
// l'autre (session dans AuthGate, droits dans AccessGate, premier chargement de
// route dans App) au lieu de repartir de zéro.
const DEPART = typeof performance === 'undefined' ? undefined : performance.now()

// Ouverture de l'app : barre d'attente au centre, sans fin ; la page qui suit
// enchaîne avec sa propre barre.
const FullScreenLoader = () => (
  <Box sx={{ height: '100dvh', bgcolor: 'background.default' }}>
    <BarreAttente place="page" duree={DUREES.chargementPage} visible depart={DEPART} />
  </Box>
)

export default FullScreenLoader
