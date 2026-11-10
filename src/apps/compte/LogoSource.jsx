import { Box } from '@mui/material'
import { radius } from '../../styles/tokens'

/**
 * Logo d'une source de données : le fichier officiel de la marque, dans ses
 * couleurs, à 28 px dans un emplacement en radius-small. Il ne porte aucun état.
 * - logo : chemin public du fichier (catalogue) ; sans fichier, l'emplacement reste vide.
 */
const LogoSource = ({ logo }) => (
  <Box
    aria-hidden="true"
    sx={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: radius.small, overflow: 'hidden', display: 'flex' }}
  >
    {logo && <Box component="img" src={logo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
  </Box>
)

export default LogoSource
