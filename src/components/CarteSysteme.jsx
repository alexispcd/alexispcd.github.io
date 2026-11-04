import { Box, Typography } from '@mui/material'
import { space } from '../styles/tokens'
import Carte from '../ui/Carte'
import Bouton from '../ui/Bouton'

// Carte d'un écran système (droits, page introuvable, erreur, nouvelle version) :
// titre et phrase, puis une seule action.
const CarteSysteme = ({ titre, phrase, bouton, onClick }) => (
  <Carte sx={{ gap: space[14] }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], pt: space[4], px: space[4] }}>
      <Typography variant="titre-barre" component="h1" sx={{ fontWeight: 700 }}>{titre}</Typography>
      <Typography variant="secondaire" sx={{ color: 'muted' }}>{phrase}</Typography>
    </Box>
    <Bouton pleineLargeur onClick={onClick}>{bouton}</Bouton>
  </Carte>
)

export default CarteSysteme
